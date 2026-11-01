package com.github.bff.access

import com.github.bff.auth.MembershipService
import com.github.bff.auth.Memberships
import com.github.bff.auth.Role
import com.github.bff.generated.model.AccessStatus
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.TreeRole
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import com.github.bff.member.MemberEntity
import com.github.bff.member.MemberRepository
import com.github.bff.problem.ApiProblem
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class TreeAccessServiceTest {
    @Autowired
    private lateinit var service: TreeAccessService

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberRepository: MemberRepository

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private lateinit var tree: UUID

    @BeforeTest
    fun createTree() {
        tree = familyRepository.saveAndFlush(FamilyEntity(name = "Access $RUN", slug = "access-$RUN")).id
        memberships.grant(tree, OWNER, Role.OWNER, null)
    }

    private fun roles(): Map<String, String> =
        jdbc.query("SELECT email, role FROM family_memberships WHERE family_id = ?", { rs, _ -> rs.getString(1) to rs.getString(2) }, tree).toMap()

    private fun audit(): List<String> =
        jdbc.query(
            "SELECT action || ' ' || coalesce(actor, '-') || ' ' || details::text FROM audit_log WHERE target_id = ? ORDER BY id",
            { rs, _ -> rs.getString(1) },
            tree.toString(),
        ).drop(1)

    private fun idOf(email: String) = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID::class.java, email)!!

    private fun assertProblem(code: ProblemCode, block: () -> Unit): ApiProblem =
        assertFailsWith<ApiProblem> { block() }.also { assertEquals(code, it.code) }

    @Test
    fun `inviting adds the person as invited and returns a text with the link`() {
        val invitation = service.share(tree, "  ${GUEST.uppercase()} ", TreeRole.EDITOR, OWNER, "de-DE,de;q=0.9,en;q=0.8")

        assertEquals(GUEST, invitation.access.email)
        assertEquals(TreeRole.EDITOR, invitation.access.role)
        assertEquals(AccessStatus.INVITED, invitation.access.status)
        assertEquals(GUEST.substringBefore('@'), invitation.access.displayName)
        assertNull(invitation.access.lastSeen)
        assertEquals("http://localhost:3000/access-$RUN", invitation.link.toString())
        assertTrue("„Access $RUN“" in invitation.text && "Bearbeiter" in invitation.text, invitation.text)
        assertTrue("http://localhost:3000/access-$RUN" in invitation.text && GUEST in invitation.text, invitation.text)
        assertTrue("einmaligen Code" in invitation.text, invitation.text)
        val invited = jdbc.queryForMap("SELECT invited_at, invited_by, first_seen FROM users WHERE email = ?", GUEST)
        assertNotNull(invited["invited_at"])
        assertEquals(OWNER, invited["invited_by"])
        assertNull(invited["first_seen"])
        assertEquals(mapOf(OWNER to "owner", GUEST to "editor"), roles())
    }

    @Test
    fun `the invitation is English unless German is asked for`() {
        jdbc.update("INSERT INTO users (email, display_name) VALUES (?, 'Ada Owner') ON CONFLICT (email) DO UPDATE SET display_name = 'Ada Owner'", OWNER)
        val english = service.share(tree, GUEST, TreeRole.VISITOR, OWNER, "fr-FR, en;q=0.5").text
        assertTrue(english.startsWith("Hello!") && "Ada Owner has invited you" in english && "as a visitor" in english, english)
        assertTrue("one-time code" in service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null).text)
        assertTrue("one-time code" in service.share(tree, GUEST, TreeRole.VISITOR, OWNER, "not a ;; header").text)
    }

    @Test
    fun `refuses invalid emails`() {
        assertProblem(ProblemCode.VALIDATION_FAILED) { service.share(tree, "not-an-email", TreeRole.VISITOR, OWNER, null) }
        assertEquals(mapOf(OWNER to "owner"), roles())
    }

    @Test
    fun `sharing again changes the role, and the list shows owners first`() {
        service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null)
        service.share(tree, GUEST, TreeRole.EDITOR, OWNER, null)
        jdbc.update("UPDATE users SET first_seen = now(), last_seen = now(), display_name = 'Aaron' WHERE email = ?", GUEST)

        val list = service.list(tree)
        assertEquals(listOf(OWNER, GUEST), list.map { it.email })
        assertEquals(listOf(TreeRole.OWNER, TreeRole.EDITOR), list.map { it.role })
        assertEquals(AccessStatus.ACTIVE, list[1].status)
        assertEquals("Aaron", list[1].displayName)
        assertEquals(idOf(GUEST), list[1].userId)
    }

    @Test
    fun `revoking removes the membership but keeps the last owner`() {
        service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null)
        service.revoke(tree, idOf(GUEST), OWNER)
        assertEquals(mapOf(OWNER to "owner"), roles())
        // The person's users row stays; only the membership goes.
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Int::class.java, GUEST))

        val lastOwner = assertProblem(ProblemCode.INVALID_REQUEST) { service.revoke(tree, idOf(OWNER), OWNER) }
        assertEquals(MembershipService.LAST_OWNER, lastOwner.detail)
        assertProblem(ProblemCode.INVALID_REQUEST) { service.share(tree, OWNER, TreeRole.EDITOR, OWNER, null) }
        assertEquals(mapOf(OWNER to "owner"), roles())
    }

    @Test
    fun `people without a role in the tree are not found`() {
        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Access other $RUN", slug = "access-other-$RUN")).id
        memberships.grant(other, GUEST, Role.EDITOR, null)

        assertProblem(ProblemCode.NOT_FOUND) { service.revoke(tree, idOf(GUEST), OWNER) }
        assertProblem(ProblemCode.NOT_FOUND) { service.transfer(tree, idOf(GUEST), OWNER) }
        assertProblem(ProblemCode.NOT_FOUND) { service.revoke(tree, UUID.randomUUID(), OWNER) }
        assertEquals(mapOf(GUEST to "editor"), jdbc.query("SELECT email, role FROM family_memberships WHERE family_id = ?", { rs, _ -> rs.getString(1) to rs.getString(2) }, other).toMap())
    }

    @Test
    fun `handing the tree over makes the person its only owner`() {
        service.share(tree, SECOND, TreeRole.OWNER, OWNER, null)
        service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null)

        service.transfer(tree, idOf(GUEST), OWNER)

        assertEquals(mapOf(OWNER to "editor", SECOND to "editor", GUEST to "owner"), roles())
        assertTrue(audit().last().startsWith("family.ownership.transferred $OWNER") && GUEST in audit().last(), audit().last())
    }

    @Test
    fun `every change is written to the audit log`() {
        service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null)
        service.share(tree, GUEST, TreeRole.EDITOR, OWNER, null)
        service.revoke(tree, idOf(GUEST), OWNER)

        val audit = audit()
        assertEquals(3, audit.size, "$audit")
        assertTrue(audit[0].startsWith("membership.granted $OWNER") && GUEST in audit[0], audit[0])
        assertTrue(audit[1].startsWith("membership.changed $OWNER") && """"role": "editor"""" in audit[1], audit[1])
        assertTrue(audit[2].startsWith("membership.revoked $OWNER") && GUEST in audit[2], audit[2])
    }

    private fun member(family: UUID, firstName: String): UUID =
        memberRepository.saveAndFlush(MemberEntity(firstName = firstName, lastName = "Access", family = familyRepository.getReferenceById(family))).id

    private fun linkOf(email: String): UUID? =
        jdbc.query(
            "SELECT member_id FROM family_memberships WHERE family_id = ? AND email = ?",
            { rs, _ -> rs.getObject(1, UUID::class.java) }, tree, email,
        ).singleOrNull()

    @Test
    fun `sharing may name the member the person is, and sharing again without one keeps it`() {
        val ada = member(tree, "Ada")
        val bert = member(tree, "Bert")

        val invitation = service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null, ada)
        assertEquals(ada, invitation.access.memberId)
        assertEquals(ada, linkOf(GUEST))
        service.share(tree, GUEST, TreeRole.EDITOR, OWNER, null)
        assertEquals(ada, linkOf(GUEST))
        service.share(tree, GUEST, TreeRole.EDITOR, OWNER, null, bert)
        assertEquals(bert, linkOf(GUEST))

        assertEquals(listOf(null, bert), service.list(tree).map { it.memberId })
        assertTrue(audit().any { it.startsWith("membership.member.linked $OWNER") && GUEST in it && bert.toString() in it }, "${audit()}")
    }

    @Test
    fun `a member taken by someone else or outside the tree changes nothing`() {
        val ada = member(tree, "Ada")
        service.share(tree, SECOND, TreeRole.EDITOR, OWNER, null, ada)
        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Access stranger $RUN", slug = "access-stranger-$RUN")).id
        val stranger = member(other, "Clara")

        assertProblem(ProblemCode.MEMBER_TAKEN) { service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null, ada) }
        assertProblem(ProblemCode.NOT_FOUND) { service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null, stranger) }
        assertProblem(ProblemCode.NOT_FOUND) { service.share(tree, GUEST, TreeRole.VISITOR, OWNER, null, UUID.randomUUID()) }

        assertEquals(mapOf(OWNER to "owner", SECOND to "editor"), roles())
        assertEquals(ada, linkOf(SECOND))
    }

    companion object {
        private val RUN = UUID.randomUUID().toString().take(8)
        private val OWNER = "ta-owner-$RUN@example.com"
        private val SECOND = "ta-second-$RUN@example.com"
        private val GUEST = "ta-guest-$RUN@example.com"
    }
}
