package com.github.bff.admin

import com.github.bff.generated.model.AuditEntry
import com.github.bff.generated.model.AuditFilters
import com.github.bff.generated.model.AuditPage
import com.github.bff.generated.model.AuditPerson
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.json.JsonMapper
import java.time.OffsetDateTime
import java.util.UUID

// Reads the audit log for the admin page; nothing here writes to it (AuditLog does).
@Service
class AuditLogService(private val jdbc: JdbcTemplate) {
    private val json = JsonMapper()

    // Newest first; `before` is the id of the last entry of the previous page. Filters are ids, never emails.
    fun page(limit: Int, before: Long?, userId: UUID?, familyId: UUID?, action: String?): AuditPage {
        val where = mutableListOf<String>()
        val args = mutableListOf<Any>()
        before?.let {
            where += "a.id < ?"
            args += it
        }
        userId?.let {
            where += "(a.actor = (SELECT email FROM users WHERE id = ?) OR (a.target_type = 'user' AND a.target_id = (SELECT email FROM users WHERE id = ?)))"
            args += it
            args += it
        }
        familyId?.let {
            where += "(a.target_type = 'family' AND a.target_id = ?)"
            args += it.toString()
        }
        action?.let {
            where += "a.action = ?"
            args += it
        }
        val rows = jdbc.query(
            "SELECT a.id, a.at, a.actor, u.id, a.action, a.target_type, a.target_id, f.name, a.details::text " +
                "FROM audit_log a LEFT JOIN users u ON u.email = a.actor " +
                "LEFT JOIN families f ON a.target_type = 'family' AND a.target_id = f.id::text " +
                (if (where.isEmpty()) "" else "WHERE ${where.joinToString(" AND ")} ") +
                "ORDER BY a.id DESC LIMIT ?",
            { rs, _ ->
                val details: Map<String, String> = json.readValue(rs.getString(9), object : TypeReference<Map<String, String>>() {})
                AuditEntry(
                    rs.getLong(1),
                    rs.getObject(2, OffsetDateTime::class.java),
                    rs.getString(3),
                    rs.getObject(4, UUID::class.java),
                    rs.getString(5),
                    rs.getString(6),
                    rs.getString(7),
                    rs.getString(8) ?: details["name"],
                    details,
                )
            },
            *args.toTypedArray(), limit + 1,
        )
        val entries = rows.take(limit)
        return AuditPage(entries, if (rows.size > limit) entries.last().id else null)
    }

    fun filters(): AuditFilters {
        val people = jdbc.query(
            "SELECT id, email, display_name FROM users WHERE email IN " +
                "(SELECT actor FROM audit_log WHERE actor IS NOT NULL UNION SELECT target_id FROM audit_log WHERE target_type = 'user') " +
                "ORDER BY lower(coalesce(display_name, email))",
        ) { rs, _ -> AuditPerson(rs.getObject(1, UUID::class.java), rs.getString(2), rs.getString(3)) }
        return AuditFilters(people, jdbc.queryForList("SELECT DISTINCT action FROM audit_log ORDER BY action", String::class.java))
    }
}
