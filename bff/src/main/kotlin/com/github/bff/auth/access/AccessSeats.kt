package com.github.bff.auth.access

import com.github.bff.auth.AccessPolicy
import com.github.bff.auth.Memberships
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowCallbackHandler
import org.springframework.stereotype.Component

// Everyone who gets past Cloudflare Access takes a seat: the bootstrap admins, admin and can_create_trees in users, and
// anyone with a role in a tree, also one in the trash, until TrashPurger removes it.
@Component
class AccessSeats(
    private val jdbc: JdbcTemplate,
    private val accessPolicy: AccessPolicy,
    private val memberships: Memberships,
    private val properties: AccessSyncProperties,
) {
    val limit: Int get() = properties.seatLimit

    // Sorted and distinct; the list AccessSync writes to the Access group.
    fun people(): List<String> = (accessPolicy.bootstrapAdmins() + memberships.people()).map { it.normalizedEmail() }.distinct().sorted()

    // Call in the transaction that gives the right, before writing it; someone who has a seat already always passes. The
    // lock lets concurrent invitations count one after another, so together they cannot pass the limit.
    fun requireSeatFor(email: String) {
        jdbc.query("SELECT pg_advisory_xact_lock(?)", RowCallbackHandler { }, SEATS_LOCK)
        val people = people()
        if (email.normalizedEmail() !in people && people.size >= limit) throw ApiProblem(ProblemCode.SEATS_EXHAUSTED)
    }

    companion object {
        // Advisory lock keys of the BFF, arbitrary but fixed.
        const val SEATS_LOCK = 0x6674_7265_6501L
        const val SYNC_LOCK = 0x6674_7265_6502L
    }
}
