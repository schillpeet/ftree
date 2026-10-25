package com.github.bff.auth

import org.springframework.stereotype.Component

@Component
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

private fun String.normalized() = trim().lowercase()

private fun List<String>.normalized() = map { it.normalized() }.filter { it.isNotEmpty() }.toSet()
