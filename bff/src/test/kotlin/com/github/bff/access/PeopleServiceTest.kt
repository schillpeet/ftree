package com.github.bff.access

import com.github.bff.auth.AccessEvents
import com.github.bff.auth.AccessPolicy
import com.github.bff.auth.AuditLog
import com.github.bff.auth.Memberships
import com.github.bff.auth.Role
import com.github.bff.auth.access.AccessGateway
import com.github.bff.auth.access.AccessSeats
import com.github.bff.auth.access.NoopAccessGateway
import com.github.bff.generated.model.AccessStatus
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.TreeRole
import com.github.bff.generated.model.UpdateAdminUserRequest
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import com.github.bff.problem.ApiProblem
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class PeopleServiceTest {
    @Autowired
    private lateinit var people: PeopleService

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var accessPolicy: AccessPolicy

    @Autowired
    private lateinit var auditLog: AuditLog

    @Autowired
    private lateinit var accessEvents: AccessEvents

    @Autowired
    private lateinit var seats: AccessSeats

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private fun idOf(email: String) = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID::class.java, email)!!

    private fun audit(email: String): List<String> =
        jdbc.queryForList("SELECT action || ' ' || coalesce(actor, '-') FROM audit_log WHERE target_type = 'user' AND target_id = ? ORDER BY id", String::class.java, email).filterNotNull()

    @Test
    fun `lists people with their trees, rights, and status`() {
        val tree = familyRepository.saveAndFlush(FamilyEntity(name = "People $RUN", slug = "people-$RUN")).id
        val trashed = familyRepository.saveAndFlush(FamilyEntity(name = "People trashed $RUN", slug = "people-trashed-$RUN", deletedAt = Instant.now())).id
        memberships.grant(tree, GUEST, Role.EDITOR, ADMIN)
        memberships.grant(trashed, GUEST, Role.OWNER, ADMIN)
        memberships.grantFlags(ADMIN, admin = true, canCreateTrees = false, grantedBy = null)
        jdbc.update("UPDATE users SET first_seen = now(), last_seen = now() WHERE email = ?", ADMIN)

        val users = people.users()
        val guest = users.single { it.email == GUEST }
        assertEquals(AccessStatus.INVITED, guest.status)
        assertEquals(ADMIN, guest.invitedBy)
        assertEquals(listOf(tree to TreeRole.EDITOR), guest.trees.map { it.familyId to it.role })
        val admin = users.single { it.email == ADMIN }
        assertTrue(admin.admin && !admin.bootstrapAdmin)
        assertEquals(AccessStatus.ACTIVE, admin.status)

        val invitations = people.invitations().filter { it.email == GUEST }
        assertEquals(listOf(tree), invitations.map { it.familyId })
        assertEquals(idOf(GUEST), invitations.single().userId)
    }

    @Test
    fun `admins change rights and names, each written to the audit log`() {
        memberships.grantFlags(GUEST, admin = false, canCreateTrees = false, grantedBy = null)
        val id = idOf(GUEST)

        val changed = people.update(id, UpdateAdminUserRequest().admin(true).canCreateTrees(true).displayName("  Grace  "), ADMIN)
        assertTrue(changed.admin && changed.canCreateTrees && !changed.bootstrapAdmin)
        assertEquals("Grace", changed.displayName)
        assertEquals("Grace", changed.customName)

        // Fields that are absent or unchanged write nothing.
        people.update(id, UpdateAdminUserRequest().admin(true), ADMIN)
        val cleared = people.update(id, UpdateAdminUserRequest().canCreateTrees(false).displayName(" "), ADMIN)
        assertFalse(cleared.canCreateTrees)
        assertNull(cleared.customName)
        assertEquals(GUEST.substringBefore('@'), cleared.displayName)

        assertEquals(
            listOf(
                "user.admin.granted $ADMIN",
                "user.can-create-trees.granted $ADMIN",
                "user.display-name.changed $ADMIN",
                "user.can-create-trees.revoked $ADMIN",
                "user.display-name.removed $ADMIN",
            ),
            audit(GUEST),
        )
    }

    @Test
    fun `admins cannot take away their own admin right`() {
        memberships.grantFlags(ADMIN, admin = true, canCreateTrees = false, grantedBy = null)
        val problem = assertFailsWith<ApiProblem> { people.update(idOf(ADMIN), UpdateAdminUserRequest().admin(false), ADMIN.uppercase()) }
        assertEquals(ProblemCode.INVALID_REQUEST, problem.code)
        assertEquals(PeopleService.OWN_ADMIN, problem.detail)
        assertEquals(ProblemCode.NOT_FOUND, assertFailsWith<ApiProblem> { people.update(UUID.randomUUID(), UpdateAdminUserRequest(), ADMIN) }.code)
    }

    @Test
    fun `people set their own display name`() {
        val profile = people.setOwnDisplayName(GUEST, " Grace Hopper ")
        assertEquals("Grace Hopper", profile.displayName)
        assertEquals(idOf(GUEST), profile.id)
        assertEquals(listOf("user.display-name.changed $GUEST"), audit(GUEST))
        assertEquals(GUEST.substringBefore('@'), people.setOwnDisplayName(GUEST, "").displayName)
        assertEquals(ProblemCode.VALIDATION_FAILED, assertFailsWith<ApiProblem> { people.setOwnDisplayName(GUEST, "x".repeat(101)) }.code)
    }

    @Test
    fun `deleting a person removes their roles and row, keeps what they created, and ends their sessions`() {
        val tree = familyRepository.saveAndFlush(FamilyEntity(name = "People $RUN", slug = "people-$RUN")).id
        memberships.grant(tree, ADMIN, Role.OWNER, null)
        memberships.grant(tree, GUEST, Role.EDITOR, ADMIN)
        jdbc.update("UPDATE families SET created_by = ? WHERE id = ?", GUEST, tree)
        val revoked = mutableListOf<String>()
        val gateway = object : AccessGateway by NoopAccessGateway {
            override fun revokeSessions(email: String) {
                revoked += email
            }
        }
        val service = PeopleService(jdbc, accessPolicy, auditLog, accessEvents, seats, gateway)

        service.delete(idOf(GUEST), ADMIN)

        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Int::class.java, GUEST))
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM family_memberships WHERE email = ?", Int::class.java, GUEST))
        assertTrue(familyRepository.existsById(tree))
        assertEquals(listOf(GUEST), revoked)
        assertEquals(emptyList(), audit(GUEST))
        assertEquals(ProblemCode.NOT_FOUND, assertFailsWith<ApiProblem> { service.delete(UUID.randomUUID(), ADMIN) }.code)
    }

    @Test
    fun `deleting still works while Cloudflare cannot end the sessions`() {
        memberships.grantFlags(GUEST, admin = false, canCreateTrees = false, grantedBy = null)
        people.delete(idOf(GUEST), ADMIN)
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Int::class.java, GUEST))
    }

    @Test
    fun `a person who is the only owner of a tree cannot be deleted until it has another owner`() {
        val sole = familyRepository.saveAndFlush(FamilyEntity(name = "People sole $RUN", slug = "people-sole-$RUN")).id
        val shared = familyRepository.saveAndFlush(FamilyEntity(name = "People shared $RUN", slug = "people-shared-$RUN")).id
        val trashed = familyRepository.saveAndFlush(FamilyEntity(name = "People trashed $RUN", slug = "people-trashed-$RUN", deletedAt = Instant.now())).id
        memberships.grant(sole, GUEST, Role.OWNER, null)
        memberships.grant(shared, GUEST, Role.OWNER, null)
        memberships.grant(shared, ADMIN, Role.OWNER, null)
        memberships.grant(trashed, GUEST, Role.OWNER, null)

        val problem = assertFailsWith<ApiProblem> { people.delete(idOf(GUEST), ADMIN) }

        assertEquals(ProblemCode.USER_OWNS_TREES, problem.code)
        assertEquals(listOf(mapOf("familyId" to sole, "familyName" to "People sole $RUN")), problem.properties["trees"])
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Int::class.java, GUEST))
        assertEquals(emptyList(), audit(GUEST))

        jdbc.update("UPDATE family_memberships SET role = 'editor' WHERE family_id = ? AND email = ?", sole, GUEST)
        memberships.grant(sole, ADMIN, Role.OWNER, null)
        people.delete(idOf(GUEST), ADMIN)
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Int::class.java, GUEST))
    }

    @Test
    fun `deleting a person replaces their email everywhere with a pseudonym`() {
        val tree = familyRepository.saveAndFlush(FamilyEntity(name = "People erased $RUN", createdBy = GUEST, deletedBy = GUEST)).id
        memberships.grant(tree, GUEST, Role.EDITOR, ADMIN)
        memberships.grant(tree, ADMIN, Role.OWNER, GUEST)
        auditLog.record(GUEST, "test.action", "user", GUEST, mapOf("email" to GUEST))
        val id = idOf(GUEST)

        people.delete(id, ADMIN)

        val pseudonym = "deleted-${id.toString().take(8)}"
        val kept = jdbc.queryForObject(
            "SELECT count(*) FROM audit_log WHERE actor = ? OR target_id = ? OR strpos(details::text, ?) > 0", Int::class.java, GUEST, GUEST, GUEST,
        )
        assertEquals(0, kept)
        assertEquals(listOf("test.action $pseudonym", "user.deleted $ADMIN"), audit(pseudonym))
        assertEquals(
            listOf(pseudonym, pseudonym, pseudonym),
            listOf(
                jdbc.queryForObject("SELECT created_by FROM families WHERE id = ?", String::class.java, tree),
                jdbc.queryForObject("SELECT deleted_by FROM families WHERE id = ?", String::class.java, tree),
                jdbc.queryForObject("SELECT granted_by FROM family_memberships WHERE family_id = ? AND email = ?", String::class.java, tree, ADMIN),
            ),
        )
    }

    @Test
    fun `admins cannot delete themselves or bootstrap admins`() {
        memberships.grantFlags(ADMIN, admin = true, canCreateTrees = false, grantedBy = null)
        val own = assertFailsWith<ApiProblem> { people.delete(idOf(ADMIN), ADMIN.uppercase()) }
        assertEquals(ProblemCode.INVALID_REQUEST, own.code)
        assertEquals(PeopleService.OWN_ACCOUNT, own.detail)

        val bootstrap = accessPolicy.bootstrapAdmins().firstOrNull() ?: return
        memberships.grantFlags(bootstrap, admin = false, canCreateTrees = false, grantedBy = null)
        val problem = assertFailsWith<ApiProblem> { people.delete(idOf(bootstrap), ADMIN) }
        assertEquals(PeopleService.BOOTSTRAP_ADMIN, problem.detail)
    }

    companion object {
        private val RUN = UUID.randomUUID().toString().take(8)
        private val ADMIN = "pe-admin-$RUN@example.com"
        private val GUEST = "pe-guest-$RUN@example.com"
    }
}
