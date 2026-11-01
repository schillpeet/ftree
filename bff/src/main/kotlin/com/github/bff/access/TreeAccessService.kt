package com.github.bff.access

import com.github.bff.auth.AuditLog
import com.github.bff.auth.MembershipService
import com.github.bff.auth.Role
import com.github.bff.auth.SelfMembers
import com.github.bff.auth.access.AccessSeats
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.AccessStatus
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.TreeAccessEntry
import com.github.bff.generated.model.TreeInvitation
import com.github.bff.generated.model.TreeRole
import com.github.bff.problem.ApiProblem
import org.springframework.beans.factory.annotation.Value
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.time.OffsetDateTime
import java.util.UUID

// Who has which role in one tree, for its owners and the admins: inviting, changing roles, removing, and handing the
// tree over. MembershipService keeps the last owner and writes the audit log; people are named by users.id, never by
// email in a URL.
@Service
class TreeAccessService(
    private val jdbc: JdbcTemplate,
    private val membershipService: MembershipService,
    private val auditLog: AuditLog,
    private val seats: AccessSeats,
    @Value("\${app.public-url:http://localhost:3000}")
    private val publicUrl: String,
    private val selfMembers: SelfMembers,
) {
    // Owners first, then by name.
    fun list(familyId: UUID): List<TreeAccessEntry> = entries(familyId, null)

    // Invites the person or changes their role, and returns the text to send them. Someone new needs a free seat. With
    // memberId the person is also linked to that member; it is checked first, so a refused link changes nothing.
    @Transactional
    fun share(familyId: UUID, email: String, role: TreeRole, actor: String, language: String?, memberId: UUID? = null): TreeInvitation {
        val key = email.normalizedEmail()
        if (!EMAIL.matches(key)) throw ApiProblem(ProblemCode.VALIDATION_FAILED)
        memberId?.let { selfMembers.requireLinkable(familyId, key, it) }
        seats.requireSeatFor(key)
        membershipService.setRole(familyId, key, Role.valueOf(role.name), actor)
        memberId?.let { selfMembers.link(familyId, key, it, actor) }
        val access = entries(familyId, key).single()
        val (name, slug) = jdbc.query("SELECT name, slug FROM families WHERE id = ?", { rs, _ -> rs.getString(1) to rs.getString(2) }, familyId)
            .single()
        val link = "${publicUrl.trim().trimEnd('/')}/$slug"
        val inviter = jdbc.query("SELECT display_name FROM users WHERE email = ?", { rs, _ -> rs.getString(1) }, actor.normalizedEmail()).singleOrNull()
        return TreeInvitation(access, URI.create(link), invitationText(language, displayNameOf(inviter, actor), name, role, link, key))
    }

    @Transactional
    fun revoke(familyId: UUID, userId: UUID, actor: String) {
        membershipService.revoke(familyId, memberEmail(familyId, userId), actor)
    }

    // Makes the person the only owner; every other owner becomes an editor. The new owner is promoted first, so the tree
    // never lacks one.
    @Transactional
    fun transfer(familyId: UUID, userId: UUID, actor: String) {
        val email = memberEmail(familyId, userId)
        membershipService.setRole(familyId, email, Role.OWNER, actor)
        val others = jdbc.queryForList(
            "SELECT email FROM family_memberships WHERE family_id = ? AND role = 'owner' AND email <> ? ORDER BY email",
            String::class.java, familyId, email,
        ).filterNotNull()
        others.forEach { membershipService.setRole(familyId, it, Role.EDITOR, actor) }
        auditLog.record(actor, "family.ownership.transferred", "family", familyId.toString(), mapOf("email" to email))
    }

    // The email of the person with this id who has a role in the family; 404 for anyone else, so ids of people outside
    // the tree reveal nothing.
    private fun memberEmail(familyId: UUID, userId: UUID): String =
        jdbc.query(
            "SELECT u.email FROM family_memberships m JOIN users u ON u.email = m.email WHERE m.family_id = ? AND u.id = ?",
            { rs, _ -> rs.getString(1) }, familyId, userId,
        ).singleOrNull() ?: throw ApiProblem(ProblemCode.NOT_FOUND)

    private fun entries(familyId: UUID, email: String?): List<TreeAccessEntry> =
        jdbc.query(
            "SELECT u.id, u.email, u.display_name, m.role, m.granted_at, u.first_seen, u.last_seen, m.member_id " +
                "FROM family_memberships m JOIN users u ON u.email = m.email WHERE m.family_id = ? " +
                (if (email == null) "" else "AND m.email = ? ") +
                "ORDER BY m.role = 'owner' DESC, lower(coalesce(nullif(trim(u.display_name), ''), split_part(u.email, '@', 1))), u.email",
            { rs, _ ->
                TreeAccessEntry(
                    rs.getObject(1, UUID::class.java),
                    rs.getString(2),
                    displayNameOf(rs.getString(3), rs.getString(2)),
                    TreeRole.fromValue(rs.getString(4)),
                    statusOf(rs.getObject(6, OffsetDateTime::class.java)),
                    rs.getObject(5, OffsetDateTime::class.java),
                    rs.getObject(7, OffsetDateTime::class.java),
                    rs.getObject(8, UUID::class.java),
                )
            },
            *listOfNotNull<Any>(familyId, email).toTypedArray(),
        )

    private companion object {
        // Enough to catch typos; Cloudflare Access decides whether the address can sign in.
        val EMAIL = Regex("""[^@\s]+@[^@\s]+\.[^@\s]+""")
    }
}

// The display name, or the part of the email before the @.
fun displayNameOf(displayName: String?, email: String): String = displayName?.takeIf { it.isNotBlank() } ?: email.substringBefore('@')

fun statusOf(firstSeen: OffsetDateTime?): AccessStatus = if (firstSeen == null) AccessStatus.INVITED else AccessStatus.ACTIVE
