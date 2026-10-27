package com.github.bff.admin

import com.github.bff.auth.AccessPolicy
import com.github.bff.auth.access.AccessSeats
import com.github.bff.auth.access.AccessSync
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.AdminFamily
import com.github.bff.generated.model.AdminFamilyMemberships
import com.github.bff.generated.model.AdminOverview
import com.github.bff.generated.model.AdminOverviewPhotos
import com.github.bff.generated.model.AdminOverviewSeats
import com.github.bff.generated.model.AdminOverviewUsers
import com.github.bff.generated.model.AdminPresence
import com.github.bff.live.PresenceDirectory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

// Reads across all trees and people for the admin page; nothing here changes data. Trashed trees count only in /admin/trash.
@Service
class AdminOverviewService(
    private val jdbc: JdbcTemplate,
    private val presence: PresenceDirectory,
    private val accessPolicy: AccessPolicy,
    private val seats: AccessSeats,
    private val accessSync: AccessSync,
) {
    fun overview(): AdminOverview {
        val signedIn = jdbc.queryForList("SELECT email FROM users WHERE first_seen IS NOT NULL", String::class.java).toSet()
        val known = signedIn + jdbc.queryForList("SELECT email FROM users", String::class.java) + accessPolicy.bootstrapAdmins()
        val (photoCount, photoBytes) = jdbc.queryForObject(
            "SELECT count(*), coalesce(sum(octet_length(data)), 0) FROM (" +
                "SELECT p.data FROM family_photos p JOIN families f ON f.id = p.family_id WHERE f.deleted_at IS NULL " +
                "UNION ALL SELECT p.data FROM member_photos p JOIN members m ON m.id = p.member_id " +
                "JOIN families f ON f.id = m.family_id WHERE f.deleted_at IS NULL) p",
        ) { rs, _ -> rs.getInt(1) to rs.getLong(2) }
        return AdminOverview(
            jdbc.queryForObject("SELECT count(*) FROM families WHERE deleted_at IS NULL", Int::class.java)!!,
            jdbc.queryForObject(
                "SELECT count(*) FROM members m JOIN families f ON f.id = m.family_id WHERE f.deleted_at IS NULL",
                Int::class.java,
            )!!,
            AdminOverviewUsers(known.size, signedIn.size, known.size - signedIn.size),
            AdminOverviewPhotos(photoCount, photoBytes),
            presence.all().map { it.email }.distinct().size,
            AdminOverviewSeats(seats.people().size, seats.limit),
            null,
        ).accessSync(accessSync.status)
    }

    fun presence(): List<AdminPresence> {
        val present = presence.all()
        if (present.isEmpty()) return emptyList()
        val families = jdbc.query("SELECT id, slug, name FROM families") { rs, _ ->
            rs.getObject(1, UUID::class.java) to (rs.getString(2) to rs.getString(3))
        }.toMap()
        val users = jdbc.query("SELECT email, id, display_name FROM users") { rs, _ ->
            rs.getString(1) to (rs.getObject(2, UUID::class.java) to rs.getString(3))
        }.toMap()
        // A family deleted a moment ago may still have clients until its presence is cleared.
        return present.mapNotNull { tab ->
            val (slug, name) = families[tab.familyId] ?: return@mapNotNull null
            val user = users[tab.email.normalizedEmail()]
            AdminPresence(
                user?.first,
                tab.email,
                user?.second?.takeIf { it.isNotBlank() } ?: tab.email.substringBefore('@'),
                tab.admin,
                tab.familyId,
                slug,
                name,
                tab.viewing,
                tab.editing,
                tab.idle,
                OffsetDateTime.ofInstant(tab.since, ZoneOffset.UTC),
            )
        }
    }

    fun families(): List<AdminFamily> {
        val roles = jdbc.query("SELECT family_id, role, count(*) FROM family_memberships GROUP BY family_id, role") { rs, _ ->
            Triple(rs.getObject(1, UUID::class.java), rs.getString(2), rs.getInt(3))
        }.groupBy({ it.first }, { it.second to it.third }).mapValues { it.value.toMap() }
        return jdbc.query(
            "SELECT f.id, f.name, f.slug, f.created_by, f.created_at, f.total_users IS NOT NULL, " +
                "(SELECT count(*) FROM members m WHERE m.family_id = f.id) FROM families f " +
                "WHERE f.deleted_at IS NULL ORDER BY f.position",
        ) { rs, _ ->
            val id = rs.getObject(1, UUID::class.java)
            val byRole = roles[id].orEmpty()
            AdminFamily(
                id,
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getObject(5, OffsetDateTime::class.java),
                rs.getBoolean(6),
                rs.getInt(7),
                AdminFamilyMemberships(byRole["owner"] ?: 0, byRole["editor"] ?: 0, byRole["visitor"] ?: 0),
            )
        }
    }
}
