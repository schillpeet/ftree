package com.github.bff.auth

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import java.time.Instant
import java.util.Date

// Signs Cloudflare Access-like tokens for the team domain and audience in src/test/resources/config.
object CloudflareTestTokens {
    val KEY: RSAKey = RSAKeyGenerator(2048).keyID("test").generate()

    fun token(
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
}

// Same validators as production, but with the local key instead of Cloudflare's JWKS endpoint.
@TestConfiguration
class CloudflareTestDecoder {
    @Bean
    @Primary
    fun testJwtDecoder(properties: AuthProperties): JwtDecoder =
        NimbusJwtDecoder.withPublicKey(CloudflareTestTokens.KEY.toRSAPublicKey()).build()
            .apply { setJwtValidator(cloudflareJwtValidator(properties.cloudflareSettings())) }
}
