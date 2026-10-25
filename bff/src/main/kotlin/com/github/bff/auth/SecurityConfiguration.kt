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
            // CSRF protection is off: the BFF keeps no session and issues no cookie. Cloudflare Access does turn its
            // CF_Authorization cookie into the JWT header, so cross-site requests are stopped elsewhere: every POST
            // needs a JSON body, which a cross-site form cannot send (DevModeTest checks the 415), PUT and DELETE
            // need a CORS preflight that only the allowed origins pass, and the Access cookie is SameSite=Lax.
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
