package com.github.bff.auth

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.util.UUID

// The rights the database keeps for one person: the global flags in users and a role per family in family_memberships.
data class Grants(
    val admin: Boolean = false,
    val canCreateTrees: Boolean = false,
    val families: Map<UUID, Role> = emptyMap(),
) {
    companion object {
        val NONE = Grants()
    }
}

fun interface AccessGrants {
    fun of(email: String): Grants
}

// Reads and grants the rights in the database; every grant is written to the audit log.
@Component
class Memberships(private val jdbc: JdbcTemplate, private val auditLog: AuditLog) : AccessGrants {
    override fun of(email: String): Grants {
        val key = email.normalizedEmail()
        val flags = jdbc.query(
            "SELECT admin, can_create_trees FROM users WHERE email = ?",
            { rs, _ -> rs.getBoolean(1) to rs.getBoolean(2) },
            key,
        ).singleOrNull()
        val families = jdbc.query(
            "SELECT family_id, role FROM family_memberships WHERE email = ?",
            { rs, _ -> rs.getObject(1, UUID::class.java) to roleOf(rs.getString(2)) },
            key,
        ).toMap()
        return Grants(flags?.first ?: false, flags?.second ?: false, families)
    }

    // Everyone with a right in the database, by email.
    fun people(): List<String> =
        jdbc.query("SELECT email FROM users WHERE admin OR can_create_trees UNION SELECT email FROM family_memberships ORDER BY 1") { rs, _ ->
            rs.getString(1)
        }

    // Gives the role in the family unless the person already has one there; true when it was granted.
    fun grant(familyId: UUID, email: String, role: Role, grantedBy: String?, source: String? = null): Boolean {
        require(role != Role.ADMIN) { "Admins are admins in every family; set users.admin instead" }
        val key = email.normalizedEmail()
        addUser(key, grantedBy)
        val granted = jdbc.update(
            "INSERT INTO family_memberships (family_id, email, role, granted_by) VALUES (?, ?, ?, ?) " +
                "ON CONFLICT (family_id, email) DO NOTHING",
            familyId, key, role.name.lowercase(), grantedBy,
        ) == 1
        if (granted) {
            auditLog.record(grantedBy, "membership.granted", "family", familyId.toString(), details(key, role.name.lowercase(), source))
        }
        return granted
    }

    // Sets the given flags, adding the person to users if missing; flags already set stay.
    fun grantFlags(email: String, admin: Boolean, canCreateTrees: Boolean, grantedBy: String?, source: String? = null) {
        val key = email.normalizedEmail()
        val before = of(key)
        addUser(key, grantedBy)
        jdbc.update(
            "UPDATE users SET admin = admin OR ?, can_create_trees = can_create_trees OR ? WHERE email = ?",
            admin, canCreateTrees, key,
        )
        if (admin && !before.admin) auditLog.record(grantedBy, "user.admin.granted", "user", key, details(null, null, source))
        if (canCreateTrees && !before.canCreateTrees) {
            auditLog.record(grantedBy, "user.can-create-trees.granted", "user", key, details(null, null, source))
        }
    }

    // Someone new is invited by whoever grants them a right; an existing row stays as it is.
    private fun addUser(email: String, invitedBy: String?) {
        jdbc.update(
            "INSERT INTO users (email, invited_at, invited_by) VALUES (?, now(), ?) ON CONFLICT (email) DO NOTHING",
            email, invitedBy,
        )
    }

    private fun details(email: String?, role: String?, source: String?) =
        listOfNotNull(email?.let { "email" to it }, role?.let { "role" to it }, source?.let { "source" to it }).toMap()

    private fun roleOf(value: String) = Role.valueOf(value.uppercase())
}

@Component
class AuditLog(private val jdbc: JdbcTemplate) {
    // actor null: the BFF itself. actor_id is the actor's users row, if there is one.
    fun record(actor: String?, action: String, targetType: String, targetId: String, details: Map<String, String> = emptyMap()) {
        jdbc.update(
            "INSERT INTO audit_log (actor, actor_id, category, action, target_type, target_id, details) " +
                "VALUES (?, (SELECT id FROM users WHERE email = ?), ?, ?, ?, ?, jsonb_object(?::text[]))",
            actor, actor, categoryOf(action), action, targetType, targetId, details.flatMap { (key, value) -> listOf(key, value) }.toTypedArray(),
        )
    }

    companion object {
        // Like the backfill in V27__categorize_the_audit_log.sql; keep both in step.
        fun categoryOf(action: String): String = when {
            action.startsWith("member.") -> "content"
            action.startsWith("membership.") || action.startsWith("user.admin.") || action.startsWith("user.can-create-trees.") ||
                action == "user.sessions.revoked" || action == "family.ownership.transferred" -> "access"
            action.startsWith("family.") -> "tree"
            action.startsWith("user.") || action.startsWith("admin.") -> "admin"
            else -> "system"
        }
    }
}
