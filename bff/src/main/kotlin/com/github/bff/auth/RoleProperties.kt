package com.github.bff.auth

import org.springframework.boot.context.properties.ConfigurationProperties

// Emails per role, e.g. APP_ROLES_ADMINS=a@example.com,b@example.com; everyone else is a visitor.
@ConfigurationProperties("app.roles")
data class RoleProperties(
    val admins: List<String> = emptyList(),
    val editors: List<String> = emptyList(),
)
