package com.github.bff.auth

import com.github.bff.auth.Permission.FAMILY_EDIT
import com.github.bff.auth.Permission.FAMILY_EXPORT
import com.github.bff.auth.Permission.FAMILY_MANAGE
import com.github.bff.auth.Permission.MEMBER_DELETE
import com.github.bff.auth.Permission.MEMBER_EDIT
import com.github.bff.auth.Permission.TREE_VIEW
import com.github.bff.parseOrigins
import jakarta.servlet.DispatcherType
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod.DELETE
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.http.HttpMethod.PUT
import org.springframework.security.config.Customizer.withDefaults
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.server.resource.web.HeaderBearerTokenResolver
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter

@Configuration
@EnableConfigurationProperties(AuthProperties::class, RoleProperties::class)
class SecurityConfiguration(
    private val authProperties: AuthProperties,
    private val roleResolver: RoleResolver,
    @Value("\${app.cors.allowed-origins:http://localhost:3000}")
    private val allowedOrigins: String,
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            // Cloudflare Access turns its CF_Authorization cookie into the JWT header, so the browser authenticates
            // requests that other sites start. Instead of tokens, which the UI would have to send, Spring's CSRF
            // protection applies only to writes that Fetch Metadata or Origin mark as coming from another site, and
            // rejects them with 403, because the BFF never issues a token.
            .csrf {
                it.requireCsrfProtectionMatcher(CrossSiteRequestMatcher(parseOrigins(allowedOrigins)))
                it.csrfTokenRepository(NoCsrfTokenRepository)
            }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .cors(withDefaults())
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .authorizeHttpRequests {
                // Error pages render the status of a request that already passed or failed these rules.
                it.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                it.requestMatchers(GET, "/me").authenticated()
                it.requestMatchers(GET, "/families/*/export").hasAuthority(FAMILY_EXPORT.key)
                it.requestMatchers(GET, "/families", "/families/*/members", "/families/*/photo", "/families/*/members/*/photo")
                    .hasAuthority(TREE_VIEW.key)
                // The legacy endpoints act on the family named "default", which need not be the one non-admins may
                // see, and the UI no longer uses them, so only admins keep them.
                it.requestMatchers("/members", "/members/**").hasAuthority(FAMILY_MANAGE.key)
                // Before PUT /families/*, which would match "order" as a family id.
                it.requestMatchers(PUT, "/families/order").hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(POST, "/families", "/families/import", "/families/*/archive", "/families/*/anonymize")
                    .hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(DELETE, "/families/*").hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(PUT, "/families/*", "/families/*/photo", "/families/*/photo-fit").hasAuthority(FAMILY_EDIT.key)
                it.requestMatchers(DELETE, "/families/*/photo").hasAuthority(FAMILY_EDIT.key)
                it.requestMatchers(DELETE, "/families/*/members/*").hasAuthority(MEMBER_DELETE.key)
                it.requestMatchers(POST, "/families/*/members").hasAuthority(MEMBER_EDIT.key)
                it.requestMatchers(
                    PUT,
                    "/families/*/members/*",
                    "/families/*/members/*/relatives",
                    "/families/*/members/*/placement",
                    "/families/*/members/*/photo",
                ).hasAuthority(MEMBER_EDIT.key)
                it.requestMatchers(DELETE, "/families/*/members/*/photo").hasAuthority(MEMBER_EDIT.key)
                it.anyRequest().denyAll()
            }
        when (authProperties.mode) {
            AuthMode.CLOUDFLARE -> http.oauth2ResourceServer {
                // HeaderBearerTokenResolver reads the raw header; DefaultBearerTokenResolver would require "Bearer ".
                it.bearerTokenResolver(HeaderBearerTokenResolver(CLOUDFLARE_ACCESS_JWT_HEADER))
                it.jwt { jwt -> jwt.jwtAuthenticationConverter(CloudflareAccessAuthenticationConverter(roleResolver)) }
            }
            AuthMode.DEV -> {
                val email = authProperties.devEmail
                log.warn("Auth mode is dev: every request runs as {} without verification. Never use this in production.", email)
                http.addFilterBefore(
                    DevAuthenticationFilter(CurrentUser(email, roleResolver.resolve(email), verified = false)),
                    AnonymousAuthenticationFilter::class.java,
                )
            }
        }
        return http.build()
    }

    // Fetches Cloudflare's signing keys on first use, so startup needs no network access.
    @Bean
    @ConditionalOnProperty(name = ["app.auth.mode"], havingValue = "cloudflare", matchIfMissing = true)
    fun jwtDecoder(): JwtDecoder {
        val settings = authProperties.cloudflareSettings()
        return NimbusJwtDecoder.withJwkSetUri(settings.jwkSetUri).build()
            .apply { setJwtValidator(cloudflareJwtValidator(settings)) }
    }

    private companion object {
        val log = LoggerFactory.getLogger(SecurityConfiguration::class.java)
    }
}
