package com.github.bff.auth

import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

// Copies the rights of the access file and families.created_by into the database once, at the first start with
// family_memberships, guarded by its entry in the audit log: the creator of a family becomes its developer, the trees of the access file become memberships,
// developer: true becomes can_create_trees and admin: true becomes admin. Families without created_by get the first bootstrap admin as
// developer. A slug no family has yet is skipped; the
// access file keeps applying next to the database (see AccessPolicy), so nobody loses access over it.
@Component
class MembershipSeed(
    private val jdbc: JdbcTemplate,
    private val accessPolicy: AccessPolicy,
    private val memberships: Memberships,
    private val auditLog: AuditLog,
    private val transactions: TransactionTemplate,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        seed()
    }

    // True when it seeded; false once the seed has run, even if every membership was removed since, or when someone
    // already has a membership.
    fun seed(): Boolean = transactions.execute {
        // Another BFF starting at the same time waits here and then finds the seed done.
        jdbc.execute("LOCK TABLE family_memberships IN EXCLUSIVE MODE")
        val done = jdbc.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM family_memberships) OR EXISTS (SELECT 1 FROM audit_log WHERE action = ?)",
            Boolean::class.java,
            SEEDED,
        )
        if (done == true) return@execute false

        var granted = 0
        jdbc.query("SELECT id, created_by FROM families WHERE created_by IS NOT NULL ORDER BY position") { rs, _ ->
            rs.getObject(1, UUID::class.java) to rs.getString(2)
        }.forEach { (family, creator) ->
            if (memberships.grant(family, creator, Role.DEVELOPER, null, "created-by")) granted++
        }

        // Families from before created_by get the first bootstrap admin as their developer.
        val owner = accessPolicy.bootstrapAdmins().firstOrNull()
        val unowned = jdbc.query("SELECT id FROM families WHERE created_by IS NULL ORDER BY position") { rs, _ -> rs.getObject(1, UUID::class.java) }
        if (owner == null && unowned.isNotEmpty()) log.warn("{} families have no creator and there is no bootstrap admin to own them", unowned.size)
        owner?.let { unowned.forEach { family -> if (memberships.grant(family, owner, Role.DEVELOPER, null, "bootstrap-admin")) granted++ } }

        val families = jdbc.query("SELECT slug, id FROM families") { rs, _ -> rs.getString(1) to rs.getObject(2, UUID::class.java) }.toMap()
        val people = accessPolicy.accessFile()
        people.forEach { (email, access) ->
            memberships.grantFlags(email, access.admin, access.developer, null, ACCESS_FILE)
            access.families.forEach { (slug, role) ->
                val family = families[slug]
                if (family == null) log.warn("The access file lists {} for the tree {}, which does not exist yet; skipped", email, slug)
                else if (memberships.grant(family, email, role, null, ACCESS_FILE)) granted++
            }
        }
        auditLog.record(null, SEEDED, "system", "family_memberships", mapOf("memberships" to "$granted", "people" to "${people.size}"))
        log.info("Seeded {} memberships from families.created_by and the access file ({} people)", granted, people.size)
        true
    }

    private companion object {
        const val SEEDED = "access_file.imported"
        const val ACCESS_FILE = "access-file"
        val log = LoggerFactory.getLogger(MembershipSeed::class.java)
    }
}
