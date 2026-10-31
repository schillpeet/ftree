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
    // The AUD tag of the admin's own Access application on its own host. When set, admin rights apply only to tokens
    // for it, so admins manage ftree there, behind a stricter policy, and are ordinary users on the tree's host.
    val adminAudience: String? = null,
    // Dev mode: whether requests count as coming through the admin application; false shows the tree host's view.
    val devAdminSession: Boolean = true,
) {
    // Fails fast so a cloudflare-mode BFF never starts without verifying tokens.
    fun cloudflareSettings(): CloudflareSettings {
        val domain = teamDomain?.trim()?.removePrefix("https://")?.trimEnd('/')
        val aud = audience?.trim()
        check(!domain.isNullOrEmpty() && !aud.isNullOrEmpty()) {
            "app.auth.mode is cloudflare, but app.auth.team-domain (APP_AUTH_TEAM_DOMAIN) or app.auth.audience " +
                "(APP_AUTH_AUDIENCE) is missing; set both, or set APP_AUTH_MODE=dev for local development."
        }
        return CloudflareSettings(domain, aud, adminAudience?.trim()?.takeIf { it.isNotEmpty() })
    }

    // Dev mode signs anyone in as anyone, so it refuses to serve a public address; the UI's address must be local.
    fun requireLocalInDevMode(publicUrl: String) {
        if (mode != AuthMode.DEV) return
        val host = runCatching { java.net.URI(publicUrl.trim()).host }.getOrNull()?.lowercase()?.removeSurrounding("[", "]")
        check(host != null && (host in LOCAL_HOSTS || host.endsWith(".localhost") || host.endsWith(".test"))) {
            "app.auth.mode is dev, which signs every request in without verification, but app.public-url (APP_PUBLIC_URL) " +
                "is $publicUrl; dev mode only runs for localhost, 127.0.0.1, ::1, *.localhost, or *.test."
        }
    }

    private companion object {
        val LOCAL_HOSTS = setOf("localhost", "127.0.0.1", "::1")
    }
}

// adminAudience: the admin application's AUD tag, or null when admins have their rights on every host.
data class CloudflareSettings(val teamDomain: String, val audience: String, val adminAudience: String? = null) {
    val issuer get() = "https://$teamDomain"
    val jwkSetUri get() = "$issuer/cdn-cgi/access/certs"
}

enum class AuthMode {
    // Cloudflare Access signs every request in front of the BFF.
    CLOUDFLARE,

    // Local development only: every request is signed in as the dev email, unverified.
    DEV,
}
