package com.github.bff.access

import com.github.bff.auth.AccessPolicy
import com.github.bff.auth.AuditLog
import com.github.bff.auth.Memberships
import com.github.bff.auth.access.AccessSeats
import com.github.bff.auth.access.AccessSyncProperties
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.TreeRole
import com.github.bff.problem.ApiProblem
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

// An invitation without a tree reserves a seat that outlives the sign-in, and needs a free seat like any new person.
@SpringBootTest
@Transactional
class SetupInvitationsTest {
    @Autowired
    private lateinit var accessPolicy: AccessPolicy

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var auditLog: AuditLog

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val seats by lazy { AccessSeats(jdbc, accessPolicy, memberships, AccessSyncProperties(seatLimit = 50)) }
    private val noSeats by lazy { AccessSeats(jdbc, accessPolicy, memberships, AccessSyncProperties(seatLimit = 0)) }

    @Test
    fun `the seat stays after sign-in without a membership`() {
        val run = UUID.randomUUID().toString().take(8)
        val email = "setup-$run@example.com"
        val invitation = SetupInvitations(jdbc, memberships, auditLog, seats, "https://ftree.example/").invite(email, TreeRole.EDITOR, "owner@example.com", "de")

        assertEquals("https://ftree.example/", invitation.link.toString())
        assertTrue(email in seats.people())
        assertTrue(invitation.text.contains("https://ftree.example/"))
        assertTrue(invitation.text.contains("Bearbeiter"))
        jdbc.update("UPDATE users SET first_seen = now(), last_seen = now() WHERE email = ?", email)
        assertTrue(email in seats.people())
    }

    @Test
    fun `someone new without a free seat is refused and nothing is written`() {
        val run = UUID.randomUUID().toString().take(8)
        val email = "setup-full-$run@example.com"
        val error = assertFailsWith<ApiProblem> { SetupInvitations(jdbc, memberships, auditLog, noSeats, "http://localhost:3000").invite(email, TreeRole.OWNER, "owner@example.com", null) }

        assertEquals(ProblemCode.SEATS_EXHAUSTED, error.code)
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Int::class.java, email))
    }
}
