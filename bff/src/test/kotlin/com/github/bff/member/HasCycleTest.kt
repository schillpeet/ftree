package com.github.bff.member

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class HasCycleTest {
    private val grandparent = UUID.randomUUID()
    private val parent = UUID.randomUUID()
    private val child = UUID.randomUUID()

    @Test
    fun `accepts a family line`() {
        assertFalse(hasCycle(mapOf(child to setOf(parent), parent to setOf(grandparent), grandparent to emptySet())))
    }

    @Test
    fun `rejects someone becoming their own ancestor`() {
        assertTrue(hasCycle(mapOf(child to setOf(parent), parent to setOf(grandparent), grandparent to setOf(child))))
    }
}
