package com.github.bff.auth

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties("app.auth")
data class AuthProperties(
    val mode: AuthMode = AuthMode.CLOUDFLARE,
    // The user every request runs as in dev mode.
    val devEmail: String = "dev@localhost",
)

enum class AuthMode {
    // Cloudflare Access signs every request in front of the BFF.
    CLOUDFLARE,

    // Local development only: every request is signed in as the dev email, unverified.
    DEV,
}
