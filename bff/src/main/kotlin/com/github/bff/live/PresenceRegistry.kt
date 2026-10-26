package com.github.bff.live

import com.github.bff.auth.normalizedEmail
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// One browser tab in one family: who it belongs to, which member it shows or edits, and whether it is idle.
data class Presence(
    val familyId: UUID,
    val clientId: String,
    val email: String,
    val admin: Boolean,
    val viewing: UUID? = null,
    val editing: UUID? = null,
    val idle: Boolean = false,
    // When the tab arrived in the family and when it last said it is still there.
    val since: Instant,
    val seen: Instant,
)

// Everyone present in every family, for views across families such as the admin overview.
interface PresenceDirectory {
    fun all(): List<Presence>
}

// Who is in which family right now. Kept in memory, so it holds only while the BFF runs as a single replica; a client
// that neither streams nor sends presence for TIMEOUT leaves.
@Component
class PresenceRegistry : PresenceDirectory {
    internal var clock: Clock = Clock.systemUTC()
    private val entries = ConcurrentHashMap<Key, Presence>()

    private data class Key(val familyId: UUID, val email: String, val clientId: String)

    // Adds the client or refreshes it, keeping what it views and edits; true when the family's presence changed.
    fun join(familyId: UUID, clientId: String, email: String, admin: Boolean): Boolean =
        put(familyId, clientId, email, admin) { it }

    // Sets what the client views and edits and whether it is idle; true when the family's presence changed.
    fun update(familyId: UUID, clientId: String, email: String, admin: Boolean, viewing: UUID?, editing: UUID?, idle: Boolean): Boolean =
        put(familyId, clientId, email, admin) { it.copy(viewing = viewing, editing = editing, idle = idle) }

    fun leave(familyId: UUID, clientId: String, email: String): Boolean =
        entries.remove(Key(familyId, email.normalizedEmail(), clientId)) != null

    // Removes the family's clients, for example after the family was deleted.
    fun clear(familyId: UUID) {
        entries.keys.removeIf { it.familyId == familyId }
    }

    // Removes the clients not seen for TIMEOUT and returns their families.
    fun expire(): Set<UUID> {
        val cutoff = clock.instant() - TIMEOUT
        val expired = entries.values.filter { it.seen < cutoff }
        expired.forEach { entries.remove(Key(it.familyId, it.email, it.clientId), it) }
        return expired.map { it.familyId }.toSet()
    }

    // The family's clients sorted by email, then client id, so every stream gets them in the same order.
    fun inFamily(familyId: UUID): List<Presence> = current().filter { it.familyId == familyId }

    override fun all(): List<Presence> = current()

    private fun current(): List<Presence> {
        val cutoff = clock.instant() - TIMEOUT
        return entries.values.filter { it.seen >= cutoff }.sortedWith(compareBy({ it.email }, { it.clientId }))
    }

    private fun put(familyId: UUID, clientId: String, email: String, admin: Boolean, change: (Presence) -> Presence): Boolean {
        val now = clock.instant()
        val key = Key(familyId, email.normalizedEmail(), clientId)
        var before: Presence? = null
        val after = entries.compute(key) { _, current ->
            before = current
            change(current?.copy(admin = admin, seen = now) ?: Presence(familyId, clientId, key.email, admin, since = now, seen = now))
        }!!
        if (before == null) dropOldestBeyondLimit(familyId, key.email)
        return before?.copy(seen = after.seen) != after
    }

    // A user opening ever new tabs, or a client inventing ids, keeps at most MAX_CLIENTS_PER_USER per family.
    private fun dropOldestBeyondLimit(familyId: UUID, email: String) {
        val clients = entries.values.filter { it.familyId == familyId && it.email == email }
        clients.sortedBy { it.seen }.dropLast(MAX_CLIENTS_PER_USER).forEach {
            entries.remove(Key(familyId, email, it.clientId), it)
        }
    }

    companion object {
        val TIMEOUT: Duration = Duration.ofSeconds(60)
        const val MAX_CLIENTS_PER_USER = 10
    }
}

// Up to two capital letters for an avatar: the first letters of the first two words of the email's local part, or
// the first letter of a single word.
fun initialsOf(email: String): String =
    email.substringBefore('@').split(Regex("[^\\p{L}\\p{N}]+")).filter { it.isNotEmpty() }
        .take(2).joinToString("") { it.take(1) }.uppercase()
