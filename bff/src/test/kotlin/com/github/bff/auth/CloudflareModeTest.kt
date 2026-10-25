package com.github.bff.auth

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import java.time.Instant
import java.util.Date
import kotlin.test.Test

@SpringBootTest(properties = ["app.roles.admins=admin@example.com", "app.roles.editors=editor@example.com"])
@AutoConfigureMockMvc
class CloudflareModeTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @TestConfiguration
    class Keys {
        // Same validators as production, but with a local key instead of Cloudflare's JWKS endpoint.
        @Bean
        @Primary
        fun testJwtDecoder(properties: AuthProperties): JwtDecoder =
            NimbusJwtDecoder.withPublicKey(KEY.toRSAPublicKey()).build()
                .apply { setJwtValidator(cloudflareJwtValidator(properties.cloudflareSettings())) }
    }

    private fun token(
        email: String? = "admin@example.com",
        audience: List<String>? = listOf("test-audience"),
        issuer: String = "https://test.cloudflareaccess.com",
        expiresAt: Instant = Instant.now().plusSeconds(300),
        key: RSAKey = KEY,
    ): String {
        val claims = JWTClaimsSet.Builder()
            .issuer(issuer)
            .audience(audience)
            .issueTime(Date.from(Instant.now().minusSeconds(60)))
            .expirationTime(Date.from(expiresAt))
            .apply { if (email != null) claim("email", email) }
            .build()
        return SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.keyID).build(), claims)
            .apply { sign(RSASSASigner(key)) }
            .serialize()
    }

    private fun me(token: String) = mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token) }

    @Test
    fun `me returns the verified user with the role from the email`() {
        me(token(email = " Admin@Example.com")).andExpect {
            status { isOk() }
            jsonPath("$.email") { value("Admin@Example.com") }
            jsonPath("$.role") { value("admin") }
            jsonPath("$.verified") { value(true) }
            jsonPath("$.permissions.length()") { value(7) }
        }
        me(token(email = "editor@example.com")).andExpect { jsonPath("$.role") { value("editor") } }
        me(token(email = "someone@example.com")).andExpect {
            jsonPath("$.role") { value("visitor") }
            jsonPath("$.permissions.length()") { value(1) }
            jsonPath("$.permissions[0]") { value("tree.view") }
        }
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

    private companion object {
        val KEY: RSAKey = RSAKeyGenerator(2048).keyID("test").generate()
    }
}
