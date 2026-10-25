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
    }
}
