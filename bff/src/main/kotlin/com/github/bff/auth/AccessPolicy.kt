package com.github.bff.auth

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.nio.file.Path
import kotlin.io.path.readText

// Who may see what, read once at startup: from the access file when APP_ACCESS_FILE is set, otherwise from the
// app.roles lists, where admins see every family and everyone else only the first one.
@Component
class AccessPolicy(accessProperties: AccessProperties, roleProperties: RoleProperties) {
    private val people: Map<String, Access>? = accessProperties.file?.trim()?.takeIf { it.isNotEmpty() }?.let { file ->
        check((roleProperties.admins + roleProperties.editors).all { it.isBlank() }) {
            "Both app.access.file (APP_ACCESS_FILE) and app.roles are set; list the admins and editors in the access file only."
        }
        parseAccessFile(Path.of(file).readText()).also { log.info("Access file {} lists {} people", file, it.size) }
    }
    private val roleResolver = RoleResolver(roleProperties)

    // Someone the access file does not list sees no family.
    fun accessOf(email: String): Access =
        if (people != null) people[email.normalizedEmail()] ?: Access.NONE
        else when (val role = roleResolver.resolve(email)) {
            Role.ADMIN -> Access(admin = true)
            else -> Access(admin = false, firstFamily = role)
        }

    private companion object {
        val log = LoggerFactory.getLogger(AccessPolicy::class.java)
    }
}
