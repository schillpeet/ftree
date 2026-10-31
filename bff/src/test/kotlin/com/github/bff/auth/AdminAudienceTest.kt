package com.github.bff.auth

import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// With an admin application, admins have their rights only with its tokens; on the tree's host they are ordinary users.
// Tested without a Spring context, since another one would open another connection pool for the whole suite.
class AdminAudienceTest {
    private val settings = CloudflareSettings("test.cloudflareaccess.com", "tree-aud", "admin-aud")
    private val policy = AccessPolicy(AccessProperties(), RoleProperties(admins = listOf("admin@example.com")), AccessGrants { Grants.NONE })

    private fun jwt(audience: List<String>, email: String = "admin@example.com") =
        Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .issuer(settings.issuer)
            .audience(audience)
            .claim("email", email)
            .issuedAt(Instant.now().minusSeconds(60))
            .expiresAt(Instant.now().plusSeconds(300))
            .build()

    private fun user(audience: List<String>, email: String = "admin@example.com", adminAudience: String? = "admin-aud") =
        CloudflareAccessAuthenticationConverter(policy, adminAudience).convert(jwt(audience, email)).principal as CurrentUser

    @Test
    fun `tokens for either application pass, others do not`() {
        val validator = cloudflareJwtValidator(settings)
        assertFalse(validator.validate(jwt(listOf("tree-aud"))).hasErrors())
        assertFalse(validator.validate(jwt(listOf("admin-aud"))).hasErrors())
        assertTrue(validator.validate(jwt(listOf("other-aud"))).hasErrors())
        assertTrue(cloudflareJwtValidator(settings.copy(adminAudience = null)).validate(jwt(listOf("admin-aud"))).hasErrors())
    }

    @Test
    fun `an admin has their rights only with a token for the admin application`() {
        val admin = user(listOf("admin-aud"))
        assertTrue(admin.adminSession && admin.access.admin && Permission.USERS_MANAGE in admin.permissions)

        val tree = user(listOf("tree-aud"))
        assertFalse(tree.adminSession || tree.access.admin)
        assertTrue(tree.access.adminElsewhere)
        assertEquals(setOf(Permission.TREE_APPEARANCE, Permission.FAMILY_CREATE), tree.permissions)

        val someone = user(listOf("admin-aud"), email = "someone@example.com")
        assertFalse(someone.access.admin || someone.access.adminElsewhere)
    }

    @Test
    fun `without an admin application every token is an admin session`() {
        val admin = user(listOf("tree-aud"), adminAudience = null)
        assertTrue(admin.adminSession && admin.access.admin)
    }
}
