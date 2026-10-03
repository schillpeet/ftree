package com.github.bff.member

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FamilyPlanningTest {
    @Test
    fun `plans exact population sizes and child links`() {
        val plan = planFamily(totalUsers = 12, generationCount = 3, minChildren = 0, maxChildren = 3)

        assertNotNull(plan)
        assertEquals(listOf(1, 3, 8), plan.groupingBy { it.generation }.eachCount().values.toList())
        plan.forEachIndexed { index, person ->
            person.parentIndex?.let { parentIndex ->
                assertTrue(parentIndex < index)
                assertEquals(person.generation - 1, plan[parentIndex].generation)
            }
        }
        for (generation in 0 until 2) {
            plan.indices
                .filter { plan[it].generation == generation }
                .forEach { parentIndex ->
                    val childCount = plan.count { it.parentIndex == parentIndex }
                    assertTrue(childCount in 0..3)
                }
        }
    }

    @Test
    fun `rejects settings that cannot fill every generation`() {
        assertNull(planFamily(totalUsers = 5, generationCount = 3, minChildren = 1, maxChildren = 1))
        assertNull(planFamily(totalUsers = 12, generationCount = 3, minChildren = 2, maxChildren = 1))
        assertFalse(planFamily(totalUsers = 12, generationCount = 3, minChildren = 0, maxChildren = 3).isNullOrEmpty())
    }
}
