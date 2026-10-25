package com.github.bff.auth

import com.github.bff.parseOrigins
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.Customizer.withDefaults
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
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
            .authorizeHttpRequests { it.anyRequest().permitAll() }
        if (authProperties.mode == AuthMode.DEV) {
            val email = authProperties.devEmail
            log.warn("Auth mode is dev: every request runs as {} without verification. Never use this in production.", email)
            http.addFilterBefore(
                DevAuthenticationFilter(CurrentUser(email, roleResolver.resolve(email), verified = false)),
                AnonymousAuthenticationFilter::class.java,
            )
        }
        return http.build()
    }

    private companion object {
        val log = LoggerFactory.getLogger(SecurityConfiguration::class.java)
    }
}
