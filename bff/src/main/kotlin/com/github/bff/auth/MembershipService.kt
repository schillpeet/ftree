package com.github.bff.auth

import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

// Changes the roles in a tree. Every tree keeps at least one owner, so the last owner can neither lose the role nor be
// removed, and every change is written to the audit log and announced as AccessChanged after the commit.
@Service
class MembershipService(
    private val jdbc: JdbcTemplate,
    private val memberships: Memberships,
    private val auditLog: AuditLog,
    private val accessEvents: AccessEvents,
) {
    // Gives the person the role in the family, granting a new membership or changing the one they have; false when they
    // had the role already.
    @Transactional
    fun setRole(familyId: UUID, email: String, role: Role, actor: String?, source: String? = null): Boolean {
        require(role != Role.ADMIN) { "Admins are admins in every family; set users.admin instead" }
        val key = email.normalizedEmail()
        val before = lockedRoleOf(familyId, key)
        when (before) {
            null -> memberships.grant(familyId, key, role, actor, source)
            role -> return false
            else -> {
                if (before == Role.OWNER) requireAnotherOwner(familyId, key)
                jdbc.update(
                    "UPDATE family_memberships SET role = ?, granted_by = ?, granted_at = now() WHERE family_id = ? AND email = ?",
                    role.name.lowercase(), actor, familyId, key,
                )
                auditLog.record(
                    actor, "membership.changed", "family", familyId.toString(),
                    listOfNotNull("email" to key, "from" to before.name.lowercase(), "role" to role.name.lowercase(), source?.let { "source" to it }).toMap(),
                )
            }
        }
        accessEvents.changed(key, familyId)
        return true
    }

    // Removes the person's membership in the family; false when they had none.
    @Transactional
    fun revoke(familyId: UUID, email: String, actor: String?): Boolean {
        val key = email.normalizedEmail()
        val before = lockedRoleOf(familyId, key) ?: return false
        if (before == Role.OWNER) requireAnotherOwner(familyId, key)
        jdbc.update("DELETE FROM family_memberships WHERE family_id = ? AND email = ?", familyId, key)
        auditLog.record(actor, "membership.revoked", "family", familyId.toString(), mapOf("email" to key, "role" to before.name.lowercase()))
        accessEvents.changed(key, familyId)
        return true
    }

    // The invited person accepts their invitation into the tree, so their role counts from now on; false when there was
    // nothing to accept. Without a membership in the tree there is no invitation (400).
    @Transactional
    fun accept(familyId: UUID, email: String): Boolean {
        val key = email.normalizedEmail()
        lockedRoleOf(familyId, key) ?: throw ApiProblem(ProblemCode.INVALID_REQUEST, NO_INVITATION)
        val accepted = jdbc.update(
            "UPDATE family_memberships SET accepted_at = now() WHERE family_id = ? AND email = ? AND accepted_at IS NULL",
            familyId, key,
        ) == 1
        if (accepted) {
            auditLog.record(key, "membership.accepted", "family", familyId.toString(), mapOf("email" to key))
            accessEvents.changed(key, familyId)
        }
        return accepted
    }

    // The invited person turns the invitation down, which removes their membership like revoke does; only an invitation
    // that is still open can be declined, so leaving a tree stays with its owners.
    @Transactional
    fun decline(familyId: UUID, email: String) {
        val key = email.normalizedEmail()
        val role = lockedRoleOf(familyId, key) ?: throw ApiProblem(ProblemCode.INVALID_REQUEST, NO_INVITATION)
        val open = jdbc.queryForObject(
            "SELECT accepted_at IS NULL FROM family_memberships WHERE family_id = ? AND email = ?",
            Boolean::class.java, familyId, key,
        ) == true
        if (!open) throw ApiProblem(ProblemCode.INVALID_REQUEST, NO_INVITATION)
        if (role == Role.OWNER) requireAnotherOwner(familyId, key)
        jdbc.update("DELETE FROM family_memberships WHERE family_id = ? AND email = ?", familyId, key)
        auditLog.record(key, "membership.declined", "family", familyId.toString(), mapOf("email" to key, "role" to role.name.lowercase()))
        accessEvents.changed(key, familyId)
    }

    // Locks the family row, so concurrent changes to its memberships run one after another and cannot remove the last
    // two owners at once.
    private fun lockedRoleOf(familyId: UUID, email: String): Role? {
        jdbc.query("SELECT id FROM families WHERE id = ? FOR UPDATE", { rs, _ -> rs.getObject(1) }, familyId)
            .ifEmpty { throw ApiProblem(ProblemCode.NOT_FOUND) }
        return jdbc.query(
            "SELECT role FROM family_memberships WHERE family_id = ? AND email = ?",
            { rs, _ -> Role.valueOf(rs.getString(1).uppercase()) },
            familyId, email,
        ).singleOrNull()
    }

    private fun requireAnotherOwner(familyId: UUID, email: String) {
        val others = jdbc.queryForObject(
            "SELECT count(*) FROM family_memberships WHERE family_id = ? AND role = 'owner' AND email <> ?",
            Int::class.java, familyId, email,
        )
        if (others == 0) throw ApiProblem(ProblemCode.INVALID_REQUEST, LAST_OWNER)
    }

    companion object {
        const val LAST_OWNER = "A tree needs at least one owner; make someone else its owner first."
        const val NO_INVITATION = "There is no open invitation into this tree for you."
    }
}
