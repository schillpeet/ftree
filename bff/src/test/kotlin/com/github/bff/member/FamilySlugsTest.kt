package com.github.bff.member

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FamilySlugsTest {
    @Test
    fun `random slugs are 10 lowercase letters or digits and skip taken ones`() {
        assertTrue(randomSlug().matches(Regex("^[a-z0-9]{10}$")))
        val first = randomSlug()
        val tries = mutableListOf<String>()
        val slug = randomSlug { tries += it; tries.size == 1 }
        assertEquals(2, tries.size)
        assertEquals(tries[1], slug)
        assertTrue(first != randomSlug())
    }
}
