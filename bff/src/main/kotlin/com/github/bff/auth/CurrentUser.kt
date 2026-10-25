package com.github.bff.auth

import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder

// verified: Cloudflare Access confirmed the email (false in dev mode).
data class CurrentUser(val email: String, val role: Role, val verified: Boolean) {
    val permissions: Set<Permission> get() = role.permissions

    companion object {
        fun current(): CurrentUser? = SecurityContextHolder.getContext().authentication?.principal as? CurrentUser
    }
}

// Grants the role's permissions as authorities, e.g. hasAuthority("member.edit").
class CurrentUserAuthentication(private val user: CurrentUser) :
    AbstractAuthenticationToken(user.permissions.map { SimpleGrantedAuthority(it.key) }) {
    init {
        isAuthenticated = true
    }

    override fun getPrincipal(): CurrentUser = user

    override fun getCredentials(): Any? = null
}
