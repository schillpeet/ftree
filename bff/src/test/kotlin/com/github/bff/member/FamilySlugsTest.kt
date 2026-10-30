package com.github.bff.member

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FamilySlugsTest {
    @Test
    fun `folds names into lowercase ascii words`() {
        assertEquals("familie-mueller", slugOf("Familie Müller"))
        assertEquals("strasse-ost", slugOf("  Straße / Ost  "))
        assertEquals("jose-s-cafe", slugOf("José's Café"))
        assertEquals("familie-1", slugOf("Familie 1"))
    }

    @Test
    fun `falls back to family when nothing is left`() {
        assertEquals("family", slugOf("!!!"))
        assertEquals("family", slugOf(""))
    }

    @Test
    fun `stays within the column and never ends on a dash`() {
        val slug = slugOf("a".repeat(59) + " b")
        assertEquals("a".repeat(59), slug)
        assertTrue(slugOf("x".repeat(200)).length == MAX_SLUG_LENGTH)
    }

    @Test
    fun `appends the first free number`() {
        val taken = setOf("schiller", "schiller-2")
        assertEquals("schiller-3", uniqueSlug("Schiller", taken::contains))
        assertEquals("mueller", uniqueSlug("Müller", taken::contains))
        val long = "a".repeat(MAX_SLUG_LENGTH)
        assertEquals("a".repeat(MAX_SLUG_LENGTH - 2) + "-2", uniqueSlug(long, setOf(long)::contains))
    }

    @Test
    fun `skips the slugs of the ui's own routes`() {
        assertEquals("terms-2", uniqueSlug("Terms", setOf<String>()::contains))
        assertEquals("privacy-2", uniqueSlug("Privacy", setOf<String>()::contains))
        assertEquals("admin-3", uniqueSlug("Admin", setOf("admin-2")::contains))
    }
}
