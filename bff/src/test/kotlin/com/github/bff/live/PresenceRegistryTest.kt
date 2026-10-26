package com.github.bff.live

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PresenceRegistryTest {
    private class MutableClock(var now: Instant = Instant.parse("2026-10-26T12:00:00Z")) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
        override fun instant(): Instant = now
    }

    private val clock = MutableClock()
    private val registry = PresenceRegistry().also { it.clock = clock }
    private val family = UUID.randomUUID()
    private val member = UUID.randomUUID()

    @Test
    fun `a client joins, updates, and leaves, and only real changes count`() {
        assertTrue(registry.join(family, "tab-1", " Manuel@Example.com", admin = false))
        assertFalse(registry.join(family, "tab-1", "manuel@example.com", admin = false), "a refresh changes nothing others see")
        assertTrue(registry.update(family, "tab-1", "manuel@example.com", false, viewing = member, editing = null, idle = false))
        assertFalse(registry.update(family, "tab-1", "manuel@example.com", false, viewing = member, editing = null, idle = false))
        assertTrue(registry.update(family, "tab-1", "manuel@example.com", false, viewing = member, editing = member, idle = true))

        val present = registry.inFamily(family).single()
        assertEquals("manuel@example.com", present.email)
        assertEquals(member, present.viewing)
        assertEquals(member, present.editing)
        assertTrue(present.idle)

        assertFalse(registry.join(family, "tab-1", "manuel@example.com", admin = false), "joining again keeps what the client views")
        assertEquals(member, registry.inFamily(family).single().viewing)

        assertTrue(registry.leave(family, "tab-1", "MANUEL@example.com"))
        assertEquals(emptyList(), registry.inFamily(family))
        assertFalse(registry.leave(family, "tab-1", "manuel@example.com"))
    }

    @Test
    fun `clients without a heartbeat for a minute expire`() {
        registry.join(family, "tab-1", "a@example.com", admin = false)
        clock.now += Duration.ofSeconds(40)
        registry.join(family, "tab-2", "b@example.com", admin = true)
        clock.now += Duration.ofSeconds(21)

        assertEquals(listOf("b@example.com"), registry.inFamily(family).map { it.email }, "expired clients are hidden at once")
        assertEquals(setOf(family), registry.expire())
        assertEquals(emptySet(), registry.expire())

        registry.update(family, "tab-2", "b@example.com", true, null, null, idle = true)
        clock.now += Duration.ofSeconds(59)
        assertEquals(emptySet(), registry.expire(), "a heartbeat restarts the minute")
        assertEquals(listOf("b@example.com"), registry.all().map { it.email })
    }

    @Test
    fun `the snapshot is sorted by email and client and spans families`() {
        val other = UUID.randomUUID()
        registry.join(family, "z", "b@example.com", admin = false)
        registry.join(family, "y", "a@example.com", admin = true)
        registry.join(family, "x", "b@example.com", admin = false)
        registry.join(other, "w", "c@example.com", admin = false)

        assertEquals(listOf("a@example.com/y", "b@example.com/x", "b@example.com/z"), registry.inFamily(family).map { "${it.email}/${it.clientId}" })
        assertEquals(4, registry.all().size)

        registry.clear(family)
        assertEquals(listOf(other), registry.all().map { it.familyId })
    }

    @Test
    fun `the same client id of two users are two clients`() {
        registry.join(family, "tab", "a@example.com", admin = false)
        registry.join(family, "tab", "b@example.com", admin = false)
        registry.update(family, "tab", "b@example.com", false, member, null, false)

        assertEquals(listOf(null, member), registry.inFamily(family).map { it.viewing })
    }

    @Test
    fun `a user keeps at most ten clients per family, dropping the oldest`() {
        (1..12).forEach {
            registry.join(family, "tab-$it", "a@example.com", admin = false)
            clock.now += Duration.ofSeconds(1)
        }

        assertEquals((3..12).map { "tab-$it" }.sorted(), registry.inFamily(family).map { it.clientId })
    }

    @Test
    fun `initials come from the local part of the email`() {
        assertEquals("MM", initialsOf("manuel.mueller@example.com"))
        assertEquals("EB", initialsOf("erna_b+tree@example.com"))
        assertEquals("D", initialsOf("dev@localhost"))
        assertEquals("ÄÖ", initialsOf("ärger-östlich@example.com"))
        assertEquals("", initialsOf("@example.com"))
    }
}
