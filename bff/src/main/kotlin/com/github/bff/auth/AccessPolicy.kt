package com.github.bff.auth

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.nio.file.Path
import kotlin.io.path.readText

// Who may see what. The database (see Memberships) decides the role in every tree and who may create trees; admins are
// only the bootstrap admins, read once at startup from the access file when APP_ACCESS_FILE is set and otherwise from
// app.roles.admins, and only in an admin session (see AuthProperties.adminAudience). MembershipSeed keeps users.admin
// equal to them.
@Component
class AccessPolicy(
    accessProperties: AccessProperties,
    private val roleProperties: RoleProperties,
    private val grants: AccessGrants,
) {
    private val people: Map<String, AccessFileEntry>? = accessProperties.file?.trim()?.takeIf { it.isNotEmpty() }?.let { file ->
        check(roleProperties.admins.all { it.isBlank() }) {
            "Both app.access.file (APP_ACCESS_FILE) and app.roles.admins are set; list the admins in the access file only."
        }
        parseAccessFile(Path.of(file).readText()).also { log.info("Access file {} lists {} people", file, it.size) }
    }
    private val bootstrapAdmins: List<String> =
        people?.filterValues { it.admin }?.keys?.toList()
            ?: roleProperties.admins.map { it.normalizedEmail() }.filter { it.isNotEmpty() }.distinct()

    // Someone without a right in the database sees no family. An admin keeps their own memberships, so a view of a tree
    // they hold no role in can be told apart (AdminViews); outside an admin session they have only those.
    fun accessOf(email: String, adminSession: Boolean = true): Access {
        val granted = grants.of(email)
        val admin = email.normalizedEmail() in bootstrapAdmins
        return Access(
            admin = admin && adminSession,
            canCreateTrees = granted.canCreateTrees,
            memberships = granted.families,
        )
    }

    // The people of the access file by email, in its order, for the one-time import; empty without an access file.
    fun accessFile(): Map<String, AccessFileEntry> = people.orEmpty()

    // The admins of the access file in its order, or of app.roles.admins.
    fun bootstrapAdmins(): List<String> = bootstrapAdmins

    private companion object {
        val log = LoggerFactory.getLogger(AccessPolicy::class.java)
    }
}
