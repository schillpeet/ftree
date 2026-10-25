package com.github.bff.auth

import java.nio.file.Files
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class AccessPolicyTest {
    private val file = Files.createTempFile("access", ".yaml").apply {
        writeText("people:\n  - email: admin@example.com\n    admin: true\n  - email: editor@example.com\n    trees:\n      schiller: editor\n")
        toFile().deleteOnExit()
    }

    @Test
    fun `the access file decides, and people it does not list see nothing`() {
        val policy = AccessPolicy(AccessProperties(file.toString()), RoleProperties())
        assertEquals(Access(admin = true), policy.accessOf("ADMIN@example.com"))
        assertEquals(Access(admin = false, families = mapOf("schiller" to Role.EDITOR)), policy.accessOf("editor@example.com"))
        assertEquals(Access.NONE, policy.accessOf("someone@example.com"))
    }

    @Test
    fun `without an access file the role lists give a role in the first family`() {
        val policy = AccessPolicy(AccessProperties(), RoleProperties(admins = listOf("admin@example.com"), editors = listOf("editor@example.com")))
        assertEquals(Access(admin = true), policy.accessOf("admin@example.com"))
        assertEquals(Access(admin = false, firstFamily = Role.EDITOR), policy.accessOf("editor@example.com"))
        assertEquals(Access(admin = false, firstFamily = Role.VISITOR), policy.accessOf("someone@example.com"))
    }

    @Test
    fun `refuses an access file next to the role lists`() {
        assertFailsWith<IllegalStateException> {
            AccessPolicy(AccessProperties(file.toString()), RoleProperties(admins = listOf("admin@example.com")))
        }
    }
}
