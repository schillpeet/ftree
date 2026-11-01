package com.github.bff.auth

import java.nio.file.Files
import java.util.UUID
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AccessPolicyTest {
    private val file = Files.createTempFile("access", ".yaml").apply {
        writeText("people:\n  - email: admin@example.com\n    admin: true\n  - email: editor@example.com\n    trees:\n      schiller: editor\n")
        toFile().deleteOnExit()
    }

    @Test
    fun `only the admins of the access file apply, and people without rights in the database see nothing`() {
        val policy = AccessPolicy(AccessProperties(file.toString()), RoleProperties(), NO_GRANTS)
        assertEquals(Access(admin = true, adminFlag = true), policy.accessOf("ADMIN@example.com"))
        assertEquals(Access.NONE, policy.accessOf("editor@example.com"))
        assertEquals(Access.NONE, policy.accessOf("someone@example.com"))
    }

    @Test
    fun `without an access file app roles admins are the bootstrap admins`() {
        val policy = AccessPolicy(AccessProperties(), RoleProperties(admins = listOf("admin@example.com")), NO_GRANTS)
        assertEquals(Access(admin = true, adminFlag = true), policy.accessOf("admin@example.com"))
        assertEquals(Access.NONE, policy.accessOf("someone@example.com"))
    }

    @Test
    fun `lists the bootstrap admins in their order`() {
        assertEquals(listOf("admin@example.com"), AccessPolicy(AccessProperties(file.toString()), RoleProperties(), NO_GRANTS).bootstrapAdmins())
        val roles = RoleProperties(admins = listOf(" Admin@example.com", "", "second@example.com", "admin@example.com"))
        assertEquals(listOf("admin@example.com", "second@example.com"), AccessPolicy(AccessProperties(), roles, NO_GRANTS).bootstrapAdmins())
    }

    @Test
    fun `refuses an access file next to app roles admins`() {
        assertFailsWith<IllegalStateException> {
            AccessPolicy(AccessProperties(file.toString()), RoleProperties(admins = listOf("admin@example.com")), NO_GRANTS)
        }
    }

    @Test
    fun `the database gives the roles per tree and the global rights`() {
        val family = UUID.randomUUID()
        val grants = AccessGrants { email ->
            when (email) {
                "editor@example.com" -> Grants(canCreateTrees = true, families = mapOf(family to Role.OWNER))
                "someone@example.com" -> Grants(admin = true)
                else -> Grants.NONE
            }
        }
        val policy = AccessPolicy(AccessProperties(file.toString()), RoleProperties(), grants)
        assertEquals(Access(admin = false, canCreateTrees = true, memberships = mapOf(family to Role.OWNER)), policy.accessOf("editor@example.com"))
        // Admins come only from the access file: users.admin alone makes nobody an admin (only the flag, which gives the
        // rights of canCreateTrees), and the bootstrap admins stay admins whatever the database says.
        assertEquals(Access(admin = false, adminFlag = true), policy.accessOf("someone@example.com"))
        assertEquals(Access(admin = true, adminFlag = true), policy.accessOf("admin@example.com"))
    }

    @Test
    fun `admins have their rights only in an admin session and keep their own trees outside it`() {
        val family = UUID.randomUUID()
        val grants = AccessGrants { email ->
            if (email == "admin@example.com") Grants(canCreateTrees = true, families = mapOf(family to Role.EDITOR)) else Grants.NONE
        }
        val policy = AccessPolicy(AccessProperties(file.toString()), RoleProperties(), grants)
        val own = mapOf(family to Role.EDITOR)
        assertEquals(Access(admin = true, canCreateTrees = true, adminFlag = true, memberships = own), policy.accessOf("admin@example.com", adminSession = true))
        assertEquals(Access(admin = false, canCreateTrees = true, adminFlag = true, memberships = own), policy.accessOf("admin@example.com", adminSession = false))
        assertEquals(Access.NONE, policy.accessOf("someone@example.com", adminSession = true))
    }

    @Test
    fun `an admin outside the admin session has the dev tools but no admin-only permission`() {
        val grants = AccessGrants { email -> if (email == "admin@example.com") Grants(admin = true) else Grants.NONE }
        val policy = AccessPolicy(AccessProperties(file.toString()), RoleProperties(), grants)

        val outside = policy.accessOf("admin@example.com", adminSession = false)
        assertFalse(outside.admin)
        assertTrue(Permission.DEV_TOOLS in outside.permissions)
        assertTrue(Permission.FAMILY_CREATE in outside.permissions)
        assertTrue(Permission.TREE_APPEARANCE in outside.permissions)
        assertFalse(Permission.USERS_VIEW in outside.permissions)

        assertEquals(Permission.entries.toSet(), policy.accessOf("admin@example.com", adminSession = true).permissions)

        val plain = policy.accessOf("plain@example.com", adminSession = false)
        assertFalse(Permission.DEV_TOOLS in plain.permissions)
    }

    private companion object {
        val NO_GRANTS = AccessGrants { Grants.NONE }
    }
}
