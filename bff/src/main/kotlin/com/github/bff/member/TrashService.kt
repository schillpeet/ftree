package com.github.bff.member

import com.github.bff.auth.AuditLog
import com.github.bff.auth.CurrentUser
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.TrashedFamily
import com.github.bff.live.TreeEvent
import com.github.bff.problem.ApiProblem
import org.slf4j.LoggerFactory
import org.springframework.context.ApplicationEventPublisher
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.time.ZoneOffset
import java.util.UUID

val TRASH_RETENTION: Duration = Duration.ofDays(30)

// Deleting a family moves it to the trash: it stays in the database with its members and memberships, invisible to
// everyone (FamilyVisibility), and keeps its name and slug. Admins restore it or remove it for good; TrashPurger does
// the latter after TRASH_RETENTION. Every step is written to the audit log.
@Service
@Transactional(readOnly = true)
class TrashService(
    private val familyRepository: FamilyRepository,
    private val memberRepository: MemberRepository,
    private val auditLog: AuditLog,
    private val events: ApplicationEventPublisher,
) {
    // Tests set the time.
    internal var clock: Clock = Clock.systemUTC()

    fun list(): List<TrashedFamily> =
        familyRepository.findAllByDeletedAtIsNotNullOrderByDeletedAtAsc().map { family ->
            val deletedAt = checkNotNull(family.deletedAt)
            TrashedFamily(
                family.id,
                family.name,
                family.slug,
                deletedAt.atOffset(ZoneOffset.UTC),
                family.deletedBy,
                (deletedAt + TRASH_RETENTION).atOffset(ZoneOffset.UTC),
                memberRepository.countByFamilyId(family.id).toInt(),
            )
        }

    // False when the family does not exist or is in the trash already.
    @Transactional
    fun trash(id: UUID): Boolean {
        val family = familyRepository.findById(id).orElse(null)?.takeIf { it.deletedAt == null } ?: return false
        val actor = CurrentUser.current()?.email?.normalizedEmail()
        family.deletedAt = clock.instant()
        family.deletedBy = actor
        familyRepository.flush()
        auditLog.record(actor, "family.trashed", "family", id.toString(), mapOf("name" to family.name))
        events.publishEvent(TreeEvent.FamilyDeleted(id))
        return true
    }

    // False when the family is not in the trash.
    @Transactional
    fun restore(id: UUID): Boolean {
        val family = trashed(id) ?: return false
        family.deletedAt = null
        family.deletedBy = null
        familyRepository.flush()
        auditLog.record(CurrentUser.current()?.email?.normalizedEmail(), "family.restored", "family", id.toString(), mapOf("name" to family.name))
        return true
    }

    // Removes a trashed family, its members, and their photos for good; false when it is not in the trash.
    @Transactional
    fun purge(id: UUID, actor: String? = CurrentUser.current()?.email?.normalizedEmail(), reason: String? = null): Boolean {
        val family = trashed(id) ?: return false
        val members = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(id)
        members.forEach { member ->
            member.parents.clear()
            member.partners.clear()
        }
        memberRepository.flush()
        memberRepository.deleteAll(members)
        familyRepository.delete(family)
        auditLog.record(actor, "family.purged", "family", id.toString(), listOfNotNull("name" to family.name, reason?.let { "reason" to it }).toMap())
        return true
    }

    // Purges every family that has been in the trash for TRASH_RETENTION; returns how many.
    @Transactional
    fun purgeExpired(): Int {
        val cutoff = clock.instant() - TRASH_RETENTION
        val expired = familyRepository.findAllByDeletedAtIsNotNullOrderByDeletedAtAsc().filter { checkNotNull(it.deletedAt) <= cutoff }
        return expired.count { purge(it.id, actor = null, reason = "expired") }
    }

    // 409 NAME_TAKEN, which says so when the trash holds the name, since nobody else can see that family.
    fun nameTaken(name: String?): ApiProblem {
        val inTrash = name != null && familyRepository.existsByNameIgnoreCaseAndDeletedAtIsNotNull(name.trim())
        return ApiProblem(ProblemCode.NAME_TAKEN, if (inTrash) "A family with this name is in the trash; restore it or remove it for good first." else null)
    }

    private fun trashed(id: UUID) = familyRepository.findById(id).orElse(null)?.takeIf { it.deletedAt != null }
}

@Component
class TrashPurger(private val trash: TrashService) {
    @Scheduled(cron = "\${app.trash.purge-cron:0 30 3 * * *}")
    fun purge() {
        val purged = trash.purgeExpired()
        if (purged > 0) log.info("Purged {} families from the trash", purged)
    }

    private companion object {
        val log = LoggerFactory.getLogger(TrashPurger::class.java)
    }
}
