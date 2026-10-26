package com.github.bff.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter

// Signs every request in as the dev user, or as the email in the DEV_EMAIL_COOKIE so two browsers can be different
// people locally. Deliberately no @Component: Spring Boot would register a filter bean for every request outside the
// security chain, so SecurityConfiguration creates it only in dev mode, and cloudflare mode never reads the cookie.
// The user is resolved per request, so rights granted in the database apply without a restart.
class DevAuthenticationFilter(private val defaultEmail: String, private val userOf: (String) -> CurrentUser) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        val email = request.cookies?.firstOrNull { it.name == DEV_EMAIL_COOKIE }?.value?.trim()
            ?.takeIf { it.length <= MAX_EMAIL_LENGTH && EMAIL.matches(it) } ?: defaultEmail
        val context = SecurityContextHolder.createEmptyContext()
        context.authentication = CurrentUserAuthentication(userOf(email))
        SecurityContextHolder.setContext(context)
        filterChain.doFilter(request, response)
    }

    companion object {
        const val DEV_EMAIL_COOKIE = "ftree-dev-email"
        private const val MAX_EMAIL_LENGTH = 320
        private val EMAIL = Regex("^[^@\\s]+@[^@\\s]+$")
    }
}
