package com.github.bff.auth.access

import com.github.bff.access.PeopleService
import com.github.bff.access.TreeAccessService
import com.github.bff.auth.AccessEvents
import com.github.bff.auth.AccessPolicy
import com.github.bff.auth.AuditLog
import com.github.bff.auth.MembershipService
import com.github.bff.auth.Memberships
import com.github.bff.auth.Role
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
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

// With no free seat, invitations and new global rights are refused before anything is written; people who have a seat
// can still change roles. The services get an AccessSeats without seats instead of a context of their own.
@SpringBootTest
@Transactional
class SeatLimitTest {
    @Autowired
    private lateinit var accessPolicy: AccessPolicy

    @Autowired
    private lateinit var membershipService: MembershipService

    @Autowired
    private lateinit var auditLog: AuditLog

    @Autowired
    private lateinit var accessEvents: AccessEvents

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val noSeats by lazy { AccessSeats(jdbc, accessPolicy, memberships, AccessSyncProperties(seatLimit = 0)) }
    private val trees by lazy { TreeAccessService(jdbc, membershipService, auditLog, noSeats, "http://localhost:3000") }
    private val people by lazy { PeopleService(jdbc, accessPolicy, auditLog, accessEvents, noSeats) }

    private fun assertSeatsExhausted(block: () -> Unit) =
        assertEquals(ProblemCode.SEATS_EXHAUSTED, assertFailsWith<ApiProblem> { block() }.code)

    @Test
    fun `inviting someone new fails, changing a role does not`() {
        val run = UUID.randomUUID().toString().take(8)
        val tree = familyRepository.saveAndFlush(FamilyEntity(name = "Seats $run", slug = "seats-$run")).id
        val owner = "owner-$run@example.com"
        memberships.grant(tree, owner, Role.OWNER, null)
        memberships.grant(tree, "guest-$run@example.com", Role.VISITOR, null)

        assertSeatsExhausted { trees.share(tree, "new-$run@example.com", TreeRole.VISITOR, owner, null) }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Int::class.java, "new-$run@example.com"))
        assertEquals(TreeRole.EDITOR, trees.share(tree, "guest-$run@example.com", TreeRole.EDITOR, owner, null).access.role)
    }

    @Test
    fun `a new global right for someone without a seat fails`() {
        val run = UUID.randomUUID().toString().take(8)
        val email = "signed-in-$run@example.com"
        jdbc.update("INSERT INTO users (email, first_seen, last_seen) VALUES (?, now(), now())", email)
        val id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID::class.java, email)!!

        assertSeatsExhausted { people.update(id, UpdateAdminUserRequest().canCreateTrees(true), "admin@example.com") }
        assertEquals(false, jdbc.queryForObject("SELECT can_create_trees FROM users WHERE id = ?", Boolean::class.java, id))
    }
}
