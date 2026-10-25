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

// Checks the signature times, the issuer (the team domain), and that the audience contains the Access application.
fun cloudflareJwtValidator(settings: CloudflareSettings): OAuth2TokenValidator<Jwt> =
    DelegatingOAuth2TokenValidator(
        JwtValidators.createDefaultWithIssuer(settings.issuer),
        OAuth2TokenValidator { jwt ->
            if (jwt.audience?.contains(settings.audience) == true) OAuth2TokenValidatorResult.success()
            else OAuth2TokenValidatorResult.failure(OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, "The token is not for this Access application", null))
        },
    )

// Access has already confirmed the email, so the user is verified.
class CloudflareAccessAuthenticationConverter(private val accessPolicy: AccessPolicy) :
    Converter<Jwt, AbstractAuthenticationToken> {
    override fun convert(jwt: Jwt): AbstractAuthenticationToken {
        val email = jwt.getClaimAsString("email")?.trim()
        if (email.isNullOrEmpty()) throw InvalidBearerTokenException("The Cloudflare Access token has no email")
        return CurrentUserAuthentication(CurrentUser(email, accessPolicy.accessOf(email), verified = true))
    }
}
