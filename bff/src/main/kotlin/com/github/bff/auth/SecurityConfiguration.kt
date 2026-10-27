package com.github.bff.auth

import com.github.bff.auth.Permission.FAMILY_CREATE
import com.github.bff.auth.Permission.FAMILY_DELETE
import com.github.bff.auth.Permission.FAMILY_EDIT
import com.github.bff.auth.Permission.FAMILY_EXPORT
import com.github.bff.auth.Permission.FAMILY_MANAGE
import com.github.bff.auth.Permission.FAMILY_SHARE
import com.github.bff.auth.Permission.MEMBER_DELETE
import com.github.bff.auth.Permission.MEMBER_EDIT
import com.github.bff.auth.Permission.TREE_VIEW
import com.github.bff.auth.Permission.USERS_MANAGE
import com.github.bff.auth.Permission.USERS_VIEW
import com.github.bff.member.FamilyVisibility
import com.github.bff.parseOrigins
import jakarta.servlet.DispatcherType
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.security.autoconfigure.actuate.web.servlet.EndpointRequest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.http.HttpMethod.DELETE
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.http.HttpMethod.PUT
import org.springframework.security.authorization.AuthorizationDecision
import org.springframework.security.authorization.AuthorizationManager
import org.springframework.security.config.Customizer.withDefaults
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.server.resource.web.HeaderBearerTokenResolver
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.security.web.access.intercept.RequestAuthorizationContext
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter
import org.springframework.web.servlet.HandlerExceptionResolver
import java.util.UUID

@Configuration
@EnableConfigurationProperties(AuthProperties::class, RoleProperties::class, AccessProperties::class)
class SecurityConfiguration(
    private val authProperties: AuthProperties,
    private val accessPolicy: AccessPolicy,
    private val familyVisibility: FamilyVisibility,
    @Value("\${app.cors.allowed-origins:http://localhost:3000}")
    private val allowedOrigins: String,
) {
    // Boot applies the security filters to the management port as well. EndpointRequest matches only there, because the
    // port differs from the app's, so the app port keeps denying /actuator. Probes and the scraper send no user, and the
    // port is never routed through the UI or the tunnel.
    @Bean
    @Order(0)
    fun managementSecurityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .securityMatcher(EndpointRequest.toAnyEndpoint())
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .authorizeHttpRequests {
                it.requestMatchers(EndpointRequest.to("health", "prometheus")).permitAll()
                // Trash: deleted families, admins only.
                it.requestMatchers(GET, "/admin/trash").hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(POST, "/admin/trash/*/restore").hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(DELETE, "/admin/trash/*").hasAuthority(FAMILY_MANAGE.key)
                it.anyRequest().denyAll()
            }
        return http.build()
    }

    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        @Qualifier("handlerExceptionResolver") exceptionResolver: HandlerExceptionResolver,
    ): SecurityFilterChain {
        // ProblemAdvice answers the 401 and 403 of these filters, so they carry the same problem details as the controllers.
        val entryPoint = AuthenticationEntryPoint { request, response, exception ->
            exceptionResolver.resolveException(request, response, null, exception)
        }
        val accessDeniedHandler = AccessDeniedHandler { request, response, exception ->
            exceptionResolver.resolveException(request, response, null, exception)
        }
        http
            .exceptionHandling {
                it.authenticationEntryPoint(entryPoint)
                it.accessDeniedHandler(accessDeniedHandler)
            }
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
                // An event stream ends with an async dispatch of the request that already passed these rules.
                it.dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
                it.requestMatchers(GET, "/me").authenticated()
                it.requestMatchers(GET, "/users", "/admin/overview", "/admin/presence", "/admin/families", "/admin/audit", "/admin/audit/filters").hasAuthority(USERS_VIEW.key)
                // Lists only the families the user may see.
                it.requestMatchers(GET, "/families").authenticated()
                it.requestMatchers(GET, "/families/{familyId}/export").access(inFamily(FAMILY_EXPORT))
                it.requestMatchers(
                    GET,
                    "/families/{familyId}/members",
                    "/families/{familyId}/photo",
                    "/families/{familyId}/members/*/photo",
                ).access(inFamily(TREE_VIEW))
                // Before PUT /families/{familyId}, which would match "order" as a family id.
                it.requestMatchers(PUT, "/families/order").hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(POST, "/families", "/families/empty", "/families/import").hasAuthority(FAMILY_CREATE.key)
                it.requestMatchers(POST, "/families/*/archive", "/families/*/anonymize").hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(DELETE, "/families/{familyId}").access(inFamily(FAMILY_DELETE))
                it.requestMatchers(PUT, "/families/{familyId}", "/families/{familyId}/photo", "/families/{familyId}/photo-fit")
                    .access(inFamily(FAMILY_EDIT))
                it.requestMatchers(DELETE, "/families/{familyId}/photo").access(inFamily(FAMILY_EDIT))
                it.requestMatchers(DELETE, "/families/{familyId}/members/*").access(inFamily(MEMBER_DELETE))
                it.requestMatchers(POST, "/families/{familyId}/members").access(inFamily(MEMBER_EDIT))
                it.requestMatchers(
                    PUT,
                    "/families/{familyId}/members/*",
                    "/families/{familyId}/members/*/relatives",
                    "/families/{familyId}/members/*/placement",
                    "/families/{familyId}/members/*/photo",
                ).access(inFamily(MEMBER_EDIT))
                it.requestMatchers(DELETE, "/families/{familyId}/members/*/photo").access(inFamily(MEMBER_EDIT))
                // Live: presence and change events of one family.
                it.requestMatchers(GET, "/families/{familyId}/events").access(inFamily(TREE_VIEW))
                it.requestMatchers(PUT, "/families/{familyId}/presence").access(inFamily(TREE_VIEW))
                // Access: owners share their own trees, admins every tree and manage people; everyone names themselves.
                it.requestMatchers(PUT, "/me").authenticated()
                it.requestMatchers(GET, "/families/{familyId}/access").access(inFamily(FAMILY_SHARE))
                it.requestMatchers(PUT, "/families/{familyId}/access").access(inFamily(FAMILY_SHARE))
                it.requestMatchers(DELETE, "/families/{familyId}/access/*").access(inFamily(FAMILY_SHARE))
                it.requestMatchers(POST, "/families/{familyId}/owner").access(inFamily(FAMILY_SHARE))
                it.requestMatchers(GET, "/admin/users", "/admin/invitations").hasAuthority(USERS_VIEW.key)
                it.requestMatchers(PUT, "/admin/users/*").hasAuthority(USERS_MANAGE.key)
                it.requestMatchers(DELETE, "/admin/users/*").hasAuthority(USERS_MANAGE.key)
                it.requestMatchers(POST, "/admin/users/*/sessions/revoke").hasAuthority(USERS_MANAGE.key)
                // Trash: deleted families, admins only.
                it.requestMatchers(GET, "/admin/trash").hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(POST, "/admin/trash/*/restore").hasAuthority(FAMILY_MANAGE.key)
                it.requestMatchers(DELETE, "/admin/trash/*").hasAuthority(FAMILY_MANAGE.key)
                it.anyRequest().denyAll()
            }
        when (authProperties.mode) {
            AuthMode.CLOUDFLARE -> http.oauth2ResourceServer {
                // HeaderBearerTokenResolver reads the raw header; DefaultBearerTokenResolver would require "Bearer ".
                it.bearerTokenResolver(HeaderBearerTokenResolver(CLOUDFLARE_ACCESS_JWT_HEADER))
                it.authenticationEntryPoint(entryPoint)
                it.accessDeniedHandler(accessDeniedHandler)
                it.jwt { jwt -> jwt.jwtAuthenticationConverter(CloudflareAccessAuthenticationConverter(accessPolicy)) }
            }
            AuthMode.DEV -> {
                val email = authProperties.devEmail
                log.warn(
                    "Auth mode is dev: every request runs as {}, or as the email in the {} cookie, without verification. " +
                        "Never use this in production.",
                    email,
                    DevAuthenticationFilter.DEV_EMAIL_COOKIE,
                )
                http.addFilterBefore(
                    DevAuthenticationFilter(email) { CurrentUser(it, accessPolicy.accessOf(it), verified = false) },
                    AnonymousAuthenticationFilter::class.java,
                )
            }
        }
        return http.build()
    }

    // Needs the permission from the user's role in the family named by {familyId}. A family the user cannot see passes
    // here, so FamilyVisibilityInterceptor answers 404 instead of revealing it with a 403.
    private fun inFamily(permission: Permission) = AuthorizationManager<RequestAuthorizationContext> { authentication, context ->
        val user = authentication.get()?.principal as? CurrentUser
        val familyId = context.variables["familyId"]?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        AuthorizationDecision(user != null && (familyId == null || familyVisibility.allows(user, familyId, permission)))
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
