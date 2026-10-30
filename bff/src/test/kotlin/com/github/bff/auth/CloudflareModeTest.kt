package com.github.bff.auth

import com.github.bff.auth.CloudflareTestTokens.token
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import jakarta.servlet.http.Cookie
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.time.Instant
import kotlin.test.Test

@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
class CloudflareModeTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    private fun me(token: String) = mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token) }

    @Test
    fun `me returns the verified user and whether the email belongs to an admin`() {
        me(token(email = " Admin@Example.com")).andExpect {
            status { isOk() }
            jsonPath("$.email") { value("Admin@Example.com") }
            jsonPath("$.admin") { value(true) }
            jsonPath("$.verified") { value(true) }
            jsonPath("$.permissions.length()") { value(13) }
        }
        listOf("editor@example.com", "someone@example.com").forEach { email ->
            me(token(email = email)).andExpect {
                jsonPath("$.admin") { value(false) }
                jsonPath("$.permissions.length()") { value(2) }
                jsonPath("$.permissions[0]") { value("tree.appearance") }
                jsonPath("$.permissions[1]") { value("family.create") }
            }
        }
    }

    @Test
    fun `the dev email cookie is ignored`() {
        val cookie = Cookie(DevAuthenticationFilter.DEV_EMAIL_COOKIE, "admin@example.com")
        mockMvc.get("/me") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "someone@example.com"))
            cookie(cookie)
        }.andExpect {
            jsonPath("$.email") { value("someone@example.com") }
            jsonPath("$.admin") { value(false) }
        }
        mockMvc.get("/me") { cookie(cookie) }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `me without a token is unauthorized`() {
        mockMvc.get("/me").andExpect { status { isUnauthorized() } }
        mockMvc.get("/me") { header("Authorization", "Bearer ${token()}") }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `tokens with a missing or wrong audience are rejected`() {
        me(token(audience = null)).andExpect { status { isUnauthorized() } }
        me(token(audience = listOf("other-audience"))).andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `tokens from another issuer, expired, foreign-signed, malformed, or without email are rejected`() {
        me(token(issuer = "https://other.cloudflareaccess.com")).andExpect { status { isUnauthorized() } }
        me(token(expiresAt = Instant.now().minusSeconds(600))).andExpect { status { isUnauthorized() } }
        me(token(key = RSAKeyGenerator(2048).keyID("other").generate())).andExpect { status { isUnauthorized() } }
        me("not-a-jwt").andExpect { status { isUnauthorized() } }
        me(token(email = null)).andExpect { status { isUnauthorized() } }
    }
}
