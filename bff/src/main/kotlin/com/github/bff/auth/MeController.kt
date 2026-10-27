package com.github.bff.auth

import com.github.bff.access.PeopleService
import com.github.bff.generated.api.MeApi
import com.github.bff.generated.model.Me
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.UpdateMeRequest
import com.github.bff.problem.ApiProblem
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import com.github.bff.generated.model.Permission as ApiPermission

@RestController
class MeController(private val people: PeopleService) : MeApi {
    override fun getMe(): ResponseEntity<Me> {
        val user = user()
        return ResponseEntity.ok(me(user, people.profile(user.email)))
    }

    override fun updateMe(updateMeRequest: UpdateMeRequest): ResponseEntity<Me> {
        val user = user()
        return ResponseEntity.ok(me(user, people.setOwnDisplayName(user.email, updateMeRequest.displayName)))
    }

    private fun user() = CurrentUser.current() ?: throw ApiProblem(ProblemCode.UNAUTHENTICATED)

    private fun me(user: CurrentUser, profile: PeopleService.Profile) =
        Me(
            profile.id,
            user.email,
            profile.displayName,
            profile.customName,
            user.access.admin,
            user.access.canCreateTrees,
            Permission.entries.filter { it in user.permissions }.map { ApiPermission.fromValue(it.key) },
            user.verified,
        )
}
