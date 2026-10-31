package com.github.bff.auth

import org.springframework.core.convert.converter.Converter
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2ErrorCodes
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException

// Cloudflare Access puts the raw JWT, without a "Bearer " prefix, into this header of every request it lets through.
const val CLOUDFLARE_ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion"

// Checks the signature times, the issuer (the team domain), and that the audience contains the Access application, or
// the admin application when there is one.
fun cloudflareJwtValidator(settings: CloudflareSettings): OAuth2TokenValidator<Jwt> =
    DelegatingOAuth2TokenValidator(
        JwtValidators.createDefaultWithIssuer(settings.issuer),
        OAuth2TokenValidator { jwt ->
            val audiences = jwt.audience.orEmpty()
            if (settings.audience in audiences || (settings.adminAudience != null && settings.adminAudience in audiences)) {
                OAuth2TokenValidatorResult.success()
            }
            else OAuth2TokenValidatorResult.failure(OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, "The token is not for this Access application", null))
        },
    )

// Access has already confirmed the email, so the user is verified. A token for the admin application, or any token
// while there is none, is an admin session, in which admins have their rights.
class CloudflareAccessAuthenticationConverter(private val accessPolicy: AccessPolicy, private val adminAudience: String?) :
    Converter<Jwt, AbstractAuthenticationToken> {
    override fun convert(jwt: Jwt): AbstractAuthenticationToken {
        val email = jwt.getClaimAsString("email")?.trim()
        if (email.isNullOrEmpty()) throw InvalidBearerTokenException("The Cloudflare Access token has no email")
        val adminSession = adminAudience == null || adminAudience in jwt.audience.orEmpty()
        return CurrentUserAuthentication(CurrentUser(email, accessPolicy.accessOf(email, adminSession), verified = true, adminSession))
    }
}
