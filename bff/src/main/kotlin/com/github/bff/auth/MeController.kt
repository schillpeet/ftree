package com.github.bff.auth

import com.github.bff.generated.api.MeApi
import com.github.bff.generated.model.Me
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import com.github.bff.generated.model.Permission as ApiPermission

@RestController
class MeController : MeApi {
    override fun getMe(): ResponseEntity<Me> {
        val user = CurrentUser.current() ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()
        return ResponseEntity.ok(
            Me(
                user.email,
                user.access.admin,
                Permission.entries.filter { it in user.permissions }.map { ApiPermission.fromValue(it.key) },
                user.verified,
            ),
        )
    }
}
