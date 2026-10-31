package com.github.bff.access

import com.github.bff.auth.AuditLog
import com.github.bff.auth.Memberships
import com.github.bff.auth.access.AccessSeats
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.SetupInvitation
import com.github.bff.generated.model.TreeRole
import com.github.bff.problem.ApiProblem
import org.springframework.beans.factory.annotation.Value
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.util.UUID

// Invitations without a tree: the person gets a seat and signs in to an empty setup, where they create their own tree as
// its owner. Like TreeAccessService, the BFF sends nothing and returns the text to copy.
@Service
class SetupInvitations(
    private val jdbc: JdbcTemplate,
    private val memberships: Memberships,
    private val auditLog: AuditLog,
    private val seats: AccessSeats,
    @Value("\${app.public-url:http://localhost:3000}")
    private val publicUrl: String,
) {
    // Reserves a seat for the person, or keeps the one they have, and returns the text to send them.
    @Transactional
    fun invite(email: String, role: TreeRole, actor: String, language: String?): SetupInvitation {
        val key = email.normalizedEmail()
        if (!EMAIL.matches(key)) throw ApiProblem(ProblemCode.VALIDATION_FAILED)
        seats.requireSeatFor(key)
        if (memberships.reserveSetupSeat(key, role.value, actor)) {
            auditLog.record(actor, "user.setup-seat.reserved", "user", key, mapOf("role" to role.value))
        }
        val user = jdbc.query(
            "SELECT id, display_name FROM users WHERE email = ?",
            { rs, _ -> rs.getObject(1, UUID::class.java) to rs.getString(2) },
            key,
        ).single()
        val link = "${publicUrl.trim().trimEnd('/')}/"
        val inviter = jdbc.query("SELECT display_name FROM users WHERE email = ?", { rs, _ -> rs.getString(1) }, actor.normalizedEmail()).singleOrNull()
        return SetupInvitation(
            user.first,
            key,
            displayNameOf(user.second, key),
            URI.create(link),
            setupInvitationText(language, displayNameOf(inviter, actor), link, key, role),
        )
    }

    private companion object {
        // Enough to catch typos; Cloudflare Access decides whether the address can sign in.
        val EMAIL = Regex("""[^@\s]+@[^@\s]+\.[^@\s]+""")
    }
}
