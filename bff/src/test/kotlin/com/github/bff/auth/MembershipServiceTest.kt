package com.github.bff.auth

import com.github.bff.generated.model.ProblemCode
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
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
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class MembershipServiceTest {
    @Autowired
    private lateinit var membershipService: MembershipService

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private lateinit var tree: UUID

    @BeforeTest
    fun createTree() {
        tree = familyRepository.saveAndFlush(FamilyEntity(name = "Shared ${UUID.randomUUID()}")).id
        memberships.grant(tree, OWNER, Role.OWNER, null)
    }

    private fun roles(): Map<String, String> =
        jdbc.query("SELECT email, role FROM family_memberships WHERE family_id = ?", { rs, _ -> rs.getString(1) to rs.getString(2) }, tree).toMap()

    private fun audit(): List<String> =
        jdbc.query(
            "SELECT action || ' ' || coalesce(actor, '-') || ' ' || details::text FROM audit_log WHERE target_id = ? ORDER BY id",
            { rs, _ -> rs.getString(1) },
            tree.toString(),
        )

    private fun assertLastOwner(block: () -> Unit) {
        val problem = assertFailsWith<ApiProblem> { block() }
        assertEquals(ProblemCode.INVALID_REQUEST, problem.code)
        assertEquals(MembershipService.LAST_OWNER, problem.detail)
    }

    @Test
    fun `the last owner can neither lose the role nor be removed`() {
        assertLastOwner { membershipService.setRole(tree, OWNER, Role.EDITOR, OWNER) }
        assertLastOwner { membershipService.revoke(tree, OWNER, OWNER) }
        assertEquals(mapOf(OWNER to "owner"), roles())
    }

    @Test
    fun `an owner may step down once there is another`() {
        membershipService.setRole(tree, SECOND.uppercase(), Role.OWNER, OWNER)
        membershipService.setRole(tree, OWNER, Role.EDITOR, SECOND)

        assertEquals(mapOf(OWNER to "editor", SECOND to "owner"), roles())
        assertLastOwner { membershipService.revoke(tree, SECOND, SECOND) }
        assertTrue(membershipService.revoke(tree, OWNER, SECOND))
        assertFalse(membershipService.revoke(tree, OWNER, SECOND))
        assertEquals(mapOf(SECOND to "owner"), roles())
    }

    @Test
    fun `every change is written to the audit log`() {
        membershipService.setRole(tree, EDITOR, Role.VISITOR, OWNER)
        membershipService.setRole(tree, EDITOR, Role.EDITOR, OWNER)
        // Setting the role someone already has changes nothing.
        membershipService.setRole(tree, EDITOR, Role.EDITOR, OWNER)
        membershipService.revoke(tree, EDITOR, OWNER)

        val audit = audit().drop(1)
        assertEquals(3, audit.size, "$audit")
        assertTrue(audit[0].startsWith("membership.granted $OWNER") && EDITOR in audit[0] && "visitor" in audit[0], audit[0])
        assertTrue(audit[1].startsWith("membership.changed $OWNER") && """"from": "visitor"""" in audit[1] && """"role": "editor"""" in audit[1], audit[1])
        assertTrue(audit[2].startsWith("membership.revoked $OWNER") && EDITOR in audit[2], audit[2])
    }

    @Test
    fun `refuses admin as a role and unknown trees`() {
        assertFailsWith<IllegalArgumentException> { membershipService.setRole(tree, EDITOR, Role.ADMIN, OWNER) }
        val missing = assertFailsWith<ApiProblem> { membershipService.setRole(UUID.randomUUID(), EDITOR, Role.EDITOR, OWNER) }
        assertEquals(ProblemCode.NOT_FOUND, missing.code)
    }

    companion object {
        private val RUN = UUID.randomUUID().toString().take(8)
        private val OWNER = "ms-owner-$RUN@example.com"
        private val SECOND = "ms-second-$RUN@example.com"
        private val EDITOR = "ms-editor-$RUN@example.com"
    }
}
