package com.github.bff.auth

import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import kotlin.io.path.writeText
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// The seed already ran when the context started, so every test starts from a database without memberships and seed;
// the transaction rolls that back afterwards. The seed reads its own access file, so the test shares the default context.
@SpringBootTest
@Transactional
class MembershipSeedTest {
    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var auditLog: AuditLog

    @Autowired
    private lateinit var transactions: TransactionTemplate

    private lateinit var seed: MembershipSeed

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private lateinit var lab: UUID
    private lateinit var own: UUID
    private lateinit var plain: UUID

    @BeforeTest
    fun forgetTheSeed() {
        val policy = AccessPolicy(AccessProperties(accessFile().toString()), RoleProperties(), memberships)
        seed = MembershipSeed(jdbc, policy, memberships, auditLog, transactions)
        jdbc.update("DELETE FROM family_memberships")
        jdbc.update("DELETE FROM audit_log")
        lab = familyRepository.saveAndFlush(FamilyEntity(name = "Lab $RUN", slug = "lab-$RUN", createdBy = BUILDER)).id
        own = familyRepository.saveAndFlush(FamilyEntity(name = "Own $RUN", slug = "own-$RUN", createdBy = ADMIN)).id
        plain = familyRepository.saveAndFlush(FamilyEntity(name = "Plain $RUN", slug = "plain-$RUN")).id
    }

    private fun memberships(): Map<Pair<UUID, String>, String> =
        jdbc.query("SELECT family_id, email, role FROM family_memberships") { rs, _ ->
            (rs.getObject(1, UUID::class.java) to rs.getString(2)) to rs.getString(3)
        }.toMap()

    private fun flags(email: String): Triple<Boolean, Boolean, Boolean>? =
        jdbc.query("SELECT admin, can_create_trees, invited_at IS NOT NULL FROM users WHERE email = ?", { rs, _ ->
            Triple(rs.getBoolean(1), rs.getBoolean(2), rs.getBoolean(3))
        }, email).singleOrNull()

    private fun audit(): List<String> =
        jdbc.query("SELECT action || ' ' || target_id || ' ' || details::text FROM audit_log ORDER BY id") { rs, _ -> rs.getString(1) }

    @Test
    fun `copies the creators and the access file into the database`() {
        assertTrue(seed.seed())

        assertEquals(
            mapOf(
                (lab to BUILDER) to "developer",
                (own to ADMIN) to "developer",
                (plain to ADMIN) to "developer",
                (lab to EDITOR) to "editor",
                (lab to VISITOR) to "visitor",
            ),
            memberships().filterKeys { it.first in setOf(lab, own, plain) },
        )
        // Nothing for the tree that does not exist yet.
        assertEquals(emptyList(), memberships().filterKeys { it.second == MISSING }.toList())
        assertEquals(Triple(true, false, true), flags(ADMIN))
        assertEquals(Triple(false, true, true), flags(BUILDER))
        assertEquals(Triple(false, false, true), flags(EDITOR))
        assertEquals(Triple(false, false, true), flags(MISSING))

        val audit = audit()
        assertTrue(audit.any { it.startsWith("membership.granted $lab") && BUILDER in it && "created-by" in it }, "$audit")
        assertTrue(audit.any { it.startsWith("membership.granted $lab") && EDITOR in it && "access-file" in it }, "$audit")
        assertTrue(audit.any { it.startsWith("user.admin.granted $ADMIN") }, "$audit")
        assertTrue(audit.any { it.startsWith("membership.granted $plain") && ADMIN in it && "bootstrap-admin" in it }, "$audit")
        assertTrue(audit.any { it.startsWith("user.can-create-trees.granted $BUILDER") }, "$audit")
        assertEquals(1, audit.count { it.startsWith("access_file.imported") })
    }

    @Test
    fun `runs exactly once`() {
        assertTrue(seed.seed())
        val memberships = memberships()
        val audit = audit()

        assertFalse(seed.seed())
        assertEquals(memberships, memberships())
        assertEquals(audit, audit())
    }

    @Test
    fun `leaves a database alone that already has memberships`() {
        jdbc.update("INSERT INTO users (email) VALUES (?) ON CONFLICT DO NOTHING", "someone@example.com")
        jdbc.update("INSERT INTO family_memberships (family_id, email, role) VALUES (?, ?, 'visitor')", lab, "someone@example.com")

        assertFalse(seed.seed())
        assertEquals(mapOf((lab to "someone@example.com") to "visitor"), memberships())
        assertEquals(emptyList(), audit())
    }

    @Test
    fun `never runs again, even after every membership was removed`() {
        assertTrue(seed.seed())
        jdbc.update("DELETE FROM family_memberships")

        assertFalse(seed.seed())
        assertEquals(emptyMap(), memberships())
    }

    @Test
    fun `invites the people it adds, and the database names them by id`() {
        seed.seed()

        assertEquals(
            1,
            jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ? AND id IS NOT NULL AND first_seen IS NULL", Int::class.java, VISITOR),
        )
    }

    @Test
    fun `keeps sign-ins and flags already set`() {
        jdbc.update("INSERT INTO users (email, first_seen, last_seen, can_create_trees) VALUES (?, now(), now(), true)", EDITOR)

        seed.seed()

        assertEquals(Triple(false, true, false), flags(EDITOR))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ? AND first_seen IS NOT NULL", Int::class.java, EDITOR))
    }

    companion object {
        private val RUN = UUID.randomUUID().toString().take(8)
        private val ADMIN = "seed-admin-$RUN@example.com"
        private val BUILDER = "seed-builder-$RUN@example.com"
        private val EDITOR = "seed-editor-$RUN@example.com"
        private val VISITOR = "seed-visitor-$RUN@example.com"
        private val SECOND_ADMIN = "seed-second-admin-$RUN@example.com"
        private val MISSING = "seed-missing-$RUN@example.com"

        private fun accessFile(): Path {
            val file = Files.createTempFile("access", ".yaml")
            file.toFile().deleteOnExit()
            file.writeText(
                """
                people:
                  - email: $ADMIN
                    admin: true
                  - email: $SECOND_ADMIN
                    admin: true
                  - email: ${BUILDER.uppercase()}
                    developer: true
                    trees:
                      lab-$RUN: editor
                  - email: $EDITOR
                    trees:
                      lab-$RUN: editor
                  - email: $VISITOR
                    trees:
                      lab-$RUN: visitor
                  - email: $MISSING
                    trees:
                      later-$RUN: editor
                """.trimIndent(),
            )
            return file
        }
    }
}
