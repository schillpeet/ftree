package com.github.bff.auth

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.security.web.csrf.CsrfTokenRepository
import org.springframework.security.web.csrf.DefaultCsrfToken
import org.springframework.security.web.util.matcher.RequestMatcher
import java.util.UUID

// Matches writes that another site started (Fetch Metadata): Sec-Fetch-Site is same-site or cross-site, or a browser
// without it sends a foreign Origin. Origins allowed by CORS stay trusted. Requests without either header, such as
// curl, carry no browser cookie and pass.
class CrossSiteRequestMatcher(private val allowedOrigins: Set<String>) : RequestMatcher {
    override fun matches(request: HttpServletRequest): Boolean {
        if (request.method in SAFE_METHODS) return false
        val origin = request.getHeader("Origin")
        if (origin != null && origin in allowedOrigins) return false
        return when (request.getHeader("Sec-Fetch-Site")) {
            "same-origin", "none" -> false
            null -> origin != null
            else -> true
        }
    }

    private companion object {
        val SAFE_METHODS = setOf("GET", "HEAD", "OPTIONS", "TRACE")
    }
}

// The BFF hands out no CSRF tokens, so a request that needs one is always rejected; nothing is stored in a session.
object NoCsrfTokenRepository : CsrfTokenRepository {
    override fun generateToken(request: HttpServletRequest): CsrfToken =
        DefaultCsrfToken("X-CSRF-TOKEN", "_csrf", UUID.randomUUID().toString())

    override fun saveToken(token: CsrfToken?, request: HttpServletRequest, response: HttpServletResponse) = Unit

    override fun loadToken(request: HttpServletRequest): CsrfToken? = null
}
