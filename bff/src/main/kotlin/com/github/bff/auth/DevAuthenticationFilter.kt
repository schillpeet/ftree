package com.github.bff.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter

// Signs every request in as the dev user. Deliberately no @Component: Spring Boot would register a filter bean
// for every request outside the security chain, so SecurityConfiguration creates it only in dev mode. The user is
// resolved per request, so rights granted in the database apply without a restart.
class DevAuthenticationFilter(private val user: () -> CurrentUser) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        val context = SecurityContextHolder.createEmptyContext()
        context.authentication = CurrentUserAuthentication(user())
        SecurityContextHolder.setContext(context)
        filterChain.doFilter(request, response)
    }
}
