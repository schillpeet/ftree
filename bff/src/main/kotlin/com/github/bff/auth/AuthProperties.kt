package com.github.bff.auth

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties("app.auth")
data class AuthProperties(
    val mode: AuthMode = AuthMode.CLOUDFLARE,
    // The user every request runs as in dev mode.
    val devEmail: String = "dev@localhost",
    // Cloudflare Access team domain, e.g. example.cloudflareaccess.com; the issuer of every token.
    val teamDomain: String? = null,
    // The Access application's AUD tag.
    val audience: String? = null,
) {
    // Fails fast so a cloudflare-mode BFF never starts without verifying tokens.
    fun cloudflareSettings(): CloudflareSettings {
        val domain = teamDomain?.trim()?.removePrefix("https://")?.trimEnd('/')
        val aud = audience?.trim()
        check(!domain.isNullOrEmpty() && !aud.isNullOrEmpty()) {
            "app.auth.mode is cloudflare, but app.auth.team-domain (APP_AUTH_TEAM_DOMAIN) or app.auth.audience " +
                "(APP_AUTH_AUDIENCE) is missing; set both, or set APP_AUTH_MODE=dev for local development."
        }
        return CloudflareSettings(domain, aud)
    }
}

data class CloudflareSettings(val teamDomain: String, val audience: String) {
    val issuer get() = "https://$teamDomain"
    val jwkSetUri get() = "$issuer/cdn-cgi/access/certs"
}

enum class AuthMode {
    // Cloudflare Access signs every request in front of the BFF.
    CLOUDFLARE,

    // Local development only: every request is signed in as the dev email, unverified.
    DEV,
}
