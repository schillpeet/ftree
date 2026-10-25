package com.github.bff.auth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class AccessFileTest {
    @Test
    fun `reads admins and roles per tree, keyed by normalized email`() {
        val people = parseAccessFile(
            """
            people:
              - email: " Admin@Example.com "
                admin: true
              - email: father@example.com
                trees:
                  schiller: editor
                  design-lab: visitor
              - email: nobody@example.com
            """.trimIndent(),
        )
        assertEquals(Access(admin = true), people["admin@example.com"])
        assertEquals(Access(admin = false, families = mapOf("schiller" to Role.EDITOR, "design-lab" to Role.VISITOR)), people["father@example.com"])
        assertEquals(Access(admin = false), people["nobody@example.com"])
    }

    @Test
    fun `rejects mistakes instead of guessing`() {
        val mistakes = mapOf(
            "people: []\nextra: 1" to "single top-level key",
            "people: {}" to "must be a list",
            "people:\n  - admin: true" to "needs an email",
            "people:\n  - email: a@example.com\n    role: editor" to "unknown keys",
            "people:\n  - email: a@example.com\n    admin: yes please" to "true or false",
            "people:\n  - email: a@example.com\n    trees: [schiller]" to "map family slugs",
            "people:\n  - email: a@example.com\n    trees:\n      Schiller: editor" to "not a family slug",
            "people:\n  - email: a@example.com\n    trees:\n      schiller: admin" to "editor or visitor",
            "people:\n  - email: a@example.com\n    admin: true\n    trees:\n      schiller: editor" to "list no trees",
            "people:\n  - email: a@example.com\n  - email: A@example.com" to "listed twice",
        )
        mistakes.forEach { (text, message) ->
            val error = assertFailsWith<IllegalArgumentException>(text) { parseAccessFile(text) }
            assertTrue(message in error.message.orEmpty(), "$text: ${error.message}")
        }
    }
}
