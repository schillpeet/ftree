package com.github.bff.auth

import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

// The member of a tree a person is, kept on their membership (family_memberships.member_id): one member per person and
// tree, one person per member. Someone without a membership, such as an admin who reaches the tree only as admin, has
// none. Every change is written to the audit log; who holds a member is never told to anyone else.
@Component
class SelfMembers(private val jdbc: JdbcTemplate, private val auditLog: AuditLog) {
    // The person's member per family id, for the families where they are linked.
    fun of(email: String): Map<UUID, UUID> =
        jdbc.query(
            "SELECT family_id, member_id FROM family_memberships WHERE email = ? AND member_id IS NOT NULL",
            { rs, _ -> rs.getObject(1, UUID::class.java) to rs.getObject(2, UUID::class.java) },
            email.normalizedEmail(),
        ).toMap()

    // Throws unless the person may be linked to the member: 404 for a member outside the family, 409 MEMBER_TAKEN when
    // someone else holds it. Locks the family row, so two people cannot claim the same member at once.
    @Transactional
    fun requireLinkable(familyId: UUID, email: String, memberId: UUID) {
        jdbc.query("SELECT id FROM families WHERE id = ? FOR UPDATE", { rs, _ -> rs.getObject(1) }, familyId)
            .ifEmpty { throw ApiProblem(ProblemCode.NOT_FOUND) }
        val exists = jdbc.queryForObject(
            "SELECT count(*) FROM members WHERE id = ? AND family_id = ?",
            Int::class.java, memberId, familyId,
        )!! > 0
        if (!exists) throw ApiProblem(ProblemCode.NOT_FOUND)
        val holder = jdbc.query(
            "SELECT email FROM family_memberships WHERE family_id = ? AND member_id = ?",
            { rs, _ -> rs.getString(1) }, familyId, memberId,
        ).singleOrNull()
        if (holder != null && holder != email.normalizedEmail()) throw ApiProblem(ProblemCode.MEMBER_TAKEN)
    }

    // Links the person's membership in the family to the member, replacing their previous link there. 400 when they have
    // no membership; see requireLinkable for the rest.
    @Transactional
    fun link(familyId: UUID, email: String, memberId: UUID, actor: String?) {
        val key = email.normalizedEmail()
        requireLinkable(familyId, key, memberId)
        val before = jdbc.query(
            "SELECT member_id FROM family_memberships WHERE family_id = ? AND email = ?",
            { rs, _ -> rs.getObject(1, UUID::class.java) }, familyId, key,
        )
        if (before.isEmpty()) throw ApiProblem(ProblemCode.INVALID_REQUEST, NO_MEMBERSHIP)
        if (before.single() == memberId) return
        jdbc.update("UPDATE family_memberships SET member_id = ? WHERE family_id = ? AND email = ?", memberId, familyId, key)
        auditLog.record(actor, "membership.member.linked", "family", familyId.toString(), mapOf("email" to key, "member" to memberId.toString()))
    }

    // Removes the person's link in the family; false when they had none.
    @Transactional
    fun unlink(familyId: UUID, email: String, actor: String?): Boolean {
        val key = email.normalizedEmail()
        val member = jdbc.query(
            "SELECT member_id FROM family_memberships WHERE family_id = ? AND email = ? AND member_id IS NOT NULL FOR UPDATE",
            { rs, _ -> rs.getObject(1, UUID::class.java) }, familyId, key,
        ).singleOrNull() ?: return false
        jdbc.update("UPDATE family_memberships SET member_id = NULL WHERE family_id = ? AND email = ?", familyId, key)
        auditLog.record(actor, "membership.member.unlinked", "family", familyId.toString(), mapOf("email" to key, "member" to member.toString()))
        return true
    }

    companion object {
        const val NO_MEMBERSHIP = "Only someone with a role in the tree can be one of its members."
    }
}
