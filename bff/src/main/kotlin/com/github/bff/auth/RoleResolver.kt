package com.github.bff.auth

// The app.roles lists, used while no access file is set.
class RoleResolver(properties: RoleProperties) {
    private val admins = properties.admins.normalized()
    private val editors = properties.editors.normalized()

    // Admin wins when an email is listed twice.
    fun resolve(email: String): Role =
        when (email.normalized()) {
            in admins -> Role.ADMIN
            in editors -> Role.EDITOR
            else -> Role.VISITOR
        }
}

private fun String.normalized() = normalizedEmail()

private fun List<String>.normalized() = map { it.normalized() }.filter { it.isNotEmpty() }.toSet()
