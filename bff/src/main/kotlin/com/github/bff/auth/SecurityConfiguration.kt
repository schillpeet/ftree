package com.github.bff.auth

import org.slf4j.LoggerFactory
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
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            // CSRF protection is off because the BFF has no session or cookie of its own: every request carries the
            // Cloudflare Access JWT in a header, which another site cannot make the browser send. The Access cookie is
            // SameSite=Lax, and the UI proxies the API on its own origin.
            .csrf { it.disable() }
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
