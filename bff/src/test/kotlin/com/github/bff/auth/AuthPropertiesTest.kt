package com.github.bff.auth

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class AuthPropertiesTest {
    @Test
    fun `cloudflare mode refuses to run without team domain or audience`() {
        listOf(
            AuthProperties(),
            AuthProperties(teamDomain = "team.cloudflareaccess.com"),
            AuthProperties(audience = "aud"),
            AuthProperties(teamDomain = " ", audience = "aud"),
            AuthProperties(teamDomain = "team.cloudflareaccess.com", audience = ""),
        ).forEach { properties ->
            val error = assertFailsWith<IllegalStateException> { properties.cloudflareSettings() }
            assertEquals(true, error.message?.contains("APP_AUTH_TEAM_DOMAIN"))
        }
    }

    @Test
    fun `derives issuer and key URL from the team domain`() {
        val settings = AuthProperties(teamDomain = " https://team.cloudflareaccess.com/ ", audience = " aud ").cloudflareSettings()
        assertEquals("https://team.cloudflareaccess.com", settings.issuer)
        assertEquals("https://team.cloudflareaccess.com/cdn-cgi/access/certs", settings.jwkSetUri)
        assertEquals("aud", settings.audience)
        assertEquals(null, settings.adminAudience)
        val admin = AuthProperties(teamDomain = "team.cloudflareaccess.com", audience = "aud", adminAudience = " admin-aud ")
        assertEquals("admin-aud", admin.cloudflareSettings().adminAudience)
        assertEquals(null, AuthProperties(teamDomain = "t", audience = "a", adminAudience = " ").cloudflareSettings().adminAudience)
    }

    @Test
    fun `dev mode runs only for a local address`() {
        val dev = AuthProperties(mode = AuthMode.DEV)
        listOf("http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000", "https://ftree.localhost", "http://ftree.test")
            .forEach { dev.requireLocalInDevMode(it) }
        listOf("https://ftree.example.org", "http://192.168.1.10:3000", "not a url", "").forEach { url ->
            val error = assertFailsWith<IllegalStateException>(url) { dev.requireLocalInDevMode(url) }
            assertEquals(true, error.message?.contains("APP_PUBLIC_URL"))
        }
        // Cloudflare mode verifies every token, so any address is fine.
        AuthProperties().requireLocalInDevMode("https://ftree.example.org")
    }
}
