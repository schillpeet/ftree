package com.github.bff.access

import com.github.bff.auth.AccessEvents
import com.github.bff.auth.AccessPolicy
import com.github.bff.auth.AuditLog
import com.github.bff.auth.access.AccessGateway
import com.github.bff.auth.access.AccessGatewayException
import com.github.bff.auth.access.AccessSeats
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.AdminInvitation
import com.github.bff.generated.model.AdminUser
import com.github.bff.generated.model.AdminUserTree
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.TreeRole
import com.github.bff.generated.model.UpdateAdminUserRequest
import com.github.bff.problem.ApiProblem
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
import java.util.UUID

// Everyone with a users row and their global rights, for the admins, and the display name people set themselves. Every
// change is written to the audit log; changes to rights are announced as AccessChanged after the commit.
@Service
class PeopleService(
    private val jdbc: JdbcTemplate,
    private val accessPolicy: AccessPolicy,
    private val auditLog: AuditLog,
    private val accessEvents: AccessEvents,
    private val seats: AccessSeats,
    private val gateway: AccessGateway,
) {
    data class Profile(val id: UUID?, val displayName: String, val customName: String?)

    fun users(): List<AdminUser> {
        val trees = jdbc.query(
            "SELECT m.email, f.id, f.name, f.slug, m.role FROM family_memberships m JOIN families f ON f.id = m.family_id " +
                "WHERE f.deleted_at IS NULL ORDER BY lower(f.name), f.id",
        ) { rs, _ -> rs.getString(1) to AdminUserTree(rs.getObject(2, UUID::class.java), rs.getString(3), rs.getString(4), TreeRole.fromValue(rs.getString(5))) }
            .groupBy({ it.first }, { it.second })
        return userRows(null).map { it.toAdminUser(trees[it.email].orEmpty()) }
            .sortedWith(compareBy({ it.displayName.lowercase() }, { it.email }))
    }

    // Sets the present fields; a new right needs a free seat. The admin right is not among them: it comes only from the
    // access file (see MembershipSeed.syncAdmins).
    @Transactional
    fun update(userId: UUID, request: UpdateAdminUserRequest, actor: String): AdminUser {
        val before = userRows(userId).singleOrNull() ?: throw ApiProblem(ProblemCode.NOT_FOUND)
        val email = before.email
        if (request.canCreateTrees == true && !before.canCreateTrees) seats.requireSeatFor(email)
        var rightsChanged = false
        request.canCreateTrees?.takeIf { it != before.canCreateTrees }?.let { canCreate ->
            jdbc.update("UPDATE users SET can_create_trees = ? WHERE email = ?", canCreate, email)
            auditLog.record(actor, if (canCreate) "user.can-create-trees.granted" else "user.can-create-trees.revoked", "user", email)
            rightsChanged = true
        }
        request.displayName?.let { setDisplayName(email, it, actor, before.customName) }
        if (rightsChanged) accessEvents.changed(email, null)
        return users().single { it.id == userId }
    }

    // Removes the person's roles and users row and replaces their email everywhere else it is kept (audit log, creators,
    // grantors, inviters, who trashed a tree) with a pseudonym, so the deletion erases them (GDPR Art. 17); the people
    // they entered in trees stay. Trees that would lose their only owner stop it; trash those first. The Access group sync, announced like any change of rights, drops
    // the address and ends the sessions of whoever has no seat left; ending them here as well is best effort, since the
    // person is gone either way.
    @Transactional
    fun delete(userId: UUID, actor: String) {
        val user = userRows(userId).singleOrNull() ?: throw ApiProblem(ProblemCode.NOT_FOUND)
        val email = user.email
        if (email == actor.normalizedEmail()) throw ApiProblem(ProblemCode.INVALID_REQUEST, OWN_ACCOUNT)
        if (email in accessPolicy.bootstrapAdmins()) throw ApiProblem(ProblemCode.INVALID_REQUEST, BOOTSTRAP_ADMIN)
        val owned = soleOwnerOf(email)
        if (owned.isNotEmpty()) {
            throw ApiProblem(ProblemCode.USER_OWNS_TREES, properties = mapOf("trees" to owned.map { mapOf("familyId" to it.first, "familyName" to it.second) }))
        }
        jdbc.update("DELETE FROM users WHERE email = ?", email)
        val pseudonym = "deleted-${userId.toString().take(8)}"
        jdbc.update("UPDATE audit_log SET actor = ? WHERE actor = ?", pseudonym, email)
        jdbc.update("UPDATE audit_log SET target_id = ? WHERE target_type = 'user' AND target_id = ?", pseudonym, email)
        jdbc.update("UPDATE audit_log SET details = replace(details::text, ?, ?)::jsonb WHERE strpos(details::text, ?) > 0", "\"$email\"", "\"$pseudonym\"", "\"$email\"")
        listOf("families" to "created_by", "families" to "deleted_by", "family_memberships" to "granted_by", "users" to "invited_by").forEach { (table, column) ->
            jdbc.update("UPDATE $table SET $column = ? WHERE $column = ?", pseudonym, email)
        }
        auditLog.record(actor, "user.deleted", "user", pseudonym)
        try {
            gateway.revokeSessions(email)
        } catch (exception: AccessGatewayException) {
            log.warn("Ending Access sessions of a deleted person failed: {}", exception.message)
        }
        accessEvents.changed(email, null)
    }

    // The trees outside the trash in which the person is the only owner, by name.
    private fun soleOwnerOf(email: String): List<Pair<UUID, String>> =
        jdbc.query(
            "SELECT f.id, f.name FROM family_memberships m JOIN families f ON f.id = m.family_id " +
                "WHERE m.email = ? AND m.role = 'owner' AND f.deleted_at IS NULL AND NOT EXISTS (" +
                "SELECT 1 FROM family_memberships o WHERE o.family_id = m.family_id AND o.role = 'owner' AND o.email <> m.email) " +
                "ORDER BY lower(f.name), f.id",
            { rs, _ -> rs.getObject(1, UUID::class.java) to rs.getString(2) }, email,
        )

    // Every membership of someone who never signed in, in a tree outside the trash, newest first.
    fun invitations(): List<AdminInvitation> =
        jdbc.query(
            "SELECT u.id, u.email, u.display_name, f.id, f.name, f.slug, m.role, m.granted_at, m.granted_by " +
                "FROM family_memberships m JOIN users u ON u.email = m.email JOIN families f ON f.id = m.family_id " +
                "WHERE u.first_seen IS NULL AND f.deleted_at IS NULL ORDER BY m.granted_at DESC, u.email, f.id",
        ) { rs, _ ->
            AdminInvitation(
                rs.getObject(1, UUID::class.java),
                rs.getString(2),
                displayNameOf(rs.getString(3), rs.getString(2)),
                rs.getObject(4, UUID::class.java),
                rs.getString(5),
                rs.getString(6),
                TreeRole.fromValue(rs.getString(7)),
                rs.getObject(8, OffsetDateTime::class.java),
                rs.getString(9),
            )
        }

    fun profile(email: String): Profile {
        val key = email.normalizedEmail()
        val row = jdbc.query("SELECT id, display_name FROM users WHERE email = ?", { rs, _ -> rs.getObject(1, UUID::class.java) to rs.getString(2) }, key)
            .singleOrNull()
        val custom = row?.second?.takeIf { it.isNotBlank() }
        return Profile(row?.first, displayNameOf(custom, key), custom)
    }

    // The signed-in user's own name; LoginRecorder has normally added their users row already.
    @Transactional
    fun setOwnDisplayName(email: String, displayName: String): Profile {
        val key = email.normalizedEmail()
        jdbc.update("INSERT INTO users (email, first_seen, last_seen) VALUES (?, now(), now()) ON CONFLICT (email) DO NOTHING", key)
        setDisplayName(key, displayName, key, profile(key).customName)
        return profile(key)
    }

    // Blank removes the name; the name itself stays out of the audit log.
    private fun setDisplayName(email: String, displayName: String, actor: String, before: String?) {
        val name = displayName.trim().takeIf { it.isNotEmpty() }
        if (name != null && name.length > MAX_NAME) throw ApiProblem(ProblemCode.VALIDATION_FAILED)
        if (name == before) return
        jdbc.update("UPDATE users SET display_name = ? WHERE email = ?", name, email)
        auditLog.record(actor, if (name == null) "user.display-name.removed" else "user.display-name.changed", "user", email)
    }

    private data class UserRow(
        val id: UUID,
        val email: String,
        val customName: String?,
        val admin: Boolean,
        val canCreateTrees: Boolean,
        val invitedAt: OffsetDateTime?,
        val invitedBy: String?,
        val firstSeen: OffsetDateTime?,
        val lastSeen: OffsetDateTime?,
    )

    private fun userRows(id: UUID?): List<UserRow> =
        jdbc.query(
            "SELECT id, email, display_name, admin, can_create_trees, invited_at, invited_by, first_seen, last_seen FROM users" +
                if (id == null) "" else " WHERE id = ?",
            { rs, _ ->
                UserRow(
                    rs.getObject(1, UUID::class.java),
                    rs.getString(2),
                    rs.getString(3)?.takeIf { it.isNotBlank() },
                    rs.getBoolean(4),
                    rs.getBoolean(5),
                    rs.getObject(6, OffsetDateTime::class.java),
                    rs.getString(7),
                    rs.getObject(8, OffsetDateTime::class.java),
                    rs.getObject(9, OffsetDateTime::class.java),
                )
            },
            *listOfNotNull<Any>(id).toTypedArray(),
        )

    private fun UserRow.toAdminUser(trees: List<AdminUserTree>): AdminUser {
        val bootstrap = email in accessPolicy.bootstrapAdmins()
        return AdminUser(
            id, email, displayNameOf(customName, email), customName, admin || bootstrap, bootstrap, canCreateTrees,
            statusOf(firstSeen), invitedAt, invitedBy, firstSeen, lastSeen, trees,
        )
    }

    companion object {
        const val OWN_ACCOUNT = "You cannot delete yourself; ask another admin."
        const val BOOTSTRAP_ADMIN = "Bootstrap admins come from the configuration and cannot be deleted."
        private const val MAX_NAME = 100
        private val log = LoggerFactory.getLogger(PeopleService::class.java)
    }
}
