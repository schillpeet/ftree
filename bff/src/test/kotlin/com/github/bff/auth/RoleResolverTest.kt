package com.github.bff.auth

import kotlin.test.Test
import kotlin.test.assertEquals

class RoleResolverTest {
    private val resolver = RoleResolver(
        RoleProperties(
            admins = listOf(" Admin@Example.com ", "both@example.com", ""),
            editors = listOf("editor@example.com", "BOTH@example.com"),
        ),
    )

    @Test
    fun `matches trimmed emails case-insensitively`() {
        assertEquals(Role.ADMIN, resolver.resolve("admin@example.com"))
        assertEquals(Role.ADMIN, resolver.resolve("  ADMIN@example.COM"))
        assertEquals(Role.EDITOR, resolver.resolve("Editor@Example.com "))
    }

    @Test
    fun `admin wins over editor`() {
        assertEquals(Role.ADMIN, resolver.resolve("both@example.com"))
    }

    @Test
    fun `everyone else is a visitor`() {
        assertEquals(Role.VISITOR, resolver.resolve("someone@example.com"))
        assertEquals(Role.VISITOR, resolver.resolve(""))
        assertEquals(Role.VISITOR, RoleResolver(RoleProperties()).resolve("admin@example.com"))
    }
}
