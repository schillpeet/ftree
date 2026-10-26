package com.github.bff.auth

import org.springframework.boot.context.properties.ConfigurationProperties

// Bootstrap admins while no access file is set, e.g. APP_ROLES_ADMINS=a@example.com,b@example.com; everyone else gets
// their rights from the database.
@ConfigurationProperties("app.roles")
data class RoleProperties(val admins: List<String> = emptyList())
