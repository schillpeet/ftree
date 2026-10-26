package com.github.bff.auth

import java.nio.file.Files
import java.util.UUID
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
        val policy = AccessPolicy(AccessProperties(file.toString()), RoleProperties(), NO_GRANTS)
        assertEquals(Access(admin = true), policy.accessOf("ADMIN@example.com"))
        assertEquals(Access(admin = false, families = mapOf("schiller" to Role.EDITOR)), policy.accessOf("editor@example.com"))
        assertEquals(Access.NONE, policy.accessOf("someone@example.com"))
    }

    @Test
    fun `without an access file the role lists give a role in the first family`() {
        val policy = AccessPolicy(AccessProperties(), RoleProperties(admins = listOf("admin@example.com"), editors = listOf("editor@example.com")), NO_GRANTS)
        assertEquals(Access(admin = true), policy.accessOf("admin@example.com"))
        assertEquals(Access(admin = false, firstFamily = Role.EDITOR), policy.accessOf("editor@example.com"))
        assertEquals(Access(admin = false, firstFamily = Role.VISITOR), policy.accessOf("someone@example.com"))
    }

    @Test
    fun `lists the access file in its order, or the admins and editors of the role lists`() {
        assertEquals(listOf("admin@example.com", "editor@example.com"), AccessPolicy(AccessProperties(file.toString()), RoleProperties(), NO_GRANTS).listed())
        val roles = RoleProperties(admins = listOf(" Admin@example.com", ""), editors = listOf("editor@example.com", "admin@example.com"))
        assertEquals(listOf("admin@example.com", "editor@example.com"), AccessPolicy(AccessProperties(), roles, NO_GRANTS).listed())
    }

    @Test
    fun `refuses an access file next to the role lists`() {
        assertFailsWith<IllegalStateException> {
            AccessPolicy(AccessProperties(file.toString()), RoleProperties(admins = listOf("admin@example.com")), NO_GRANTS)
        }
    }

    @Test
    fun `the rights in the database add to the access file and the role lists`() {
        val family = UUID.randomUUID()
        val grants = AccessGrants { email ->
            when (email) {
                "editor@example.com" -> Grants(canCreateTrees = true, families = mapOf(family to Role.VISITOR))
                "someone@example.com" -> Grants(admin = true)
                else -> Grants.NONE
            }
        }
        val policy = AccessPolicy(AccessProperties(file.toString()), RoleProperties(), grants)
        assertEquals(
            Access(admin = false, families = mapOf("schiller" to Role.EDITOR), developer = true, memberships = mapOf(family to Role.VISITOR)),
            policy.accessOf("editor@example.com"),
        )
        assertEquals(Access(admin = true), policy.accessOf("someone@example.com"))
        // The access file keeps its admins whatever the database says.
        assertEquals(Access(admin = true), policy.accessOf("admin@example.com"))

        val roles = AccessPolicy(AccessProperties(), RoleProperties(admins = listOf("admin@example.com")), grants)
        assertEquals(Access(admin = true), roles.accessOf("someone@example.com"))
        assertEquals(
            Access(admin = false, firstFamily = Role.VISITOR, developer = true, memberships = mapOf(family to Role.VISITOR)),
            roles.accessOf("editor@example.com"),
        )
    }

    private companion object {
        val NO_GRANTS = AccessGrants { Grants.NONE }
    }
}
