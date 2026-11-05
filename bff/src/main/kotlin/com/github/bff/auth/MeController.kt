package com.github.bff.auth

import com.github.bff.access.PeopleService
import com.github.bff.generated.api.MeApi
import com.github.bff.generated.model.Me
import com.github.bff.generated.model.MyInvitation
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.UpdateMeRequest
import com.github.bff.legal.LegalService
import com.github.bff.problem.ApiProblem
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Component
import org.springframework.web.bind.annotation.RestController
import com.github.bff.generated.model.Permission as ApiPermission

@RestController
class MeController(private val people: PeopleService, private val meResponses: MeResponses) : MeApi {
    override fun getMe(): ResponseEntity<Me> = ResponseEntity.ok(meResponses.of(user()))

    override fun updateMe(updateMeRequest: UpdateMeRequest): ResponseEntity<Me> {
        val user = user()
        people.setOwnDisplayName(user.email, updateMeRequest.displayName)
        return ResponseEntity.ok(meResponses.of(user))
    }

    override fun listMyInvitations(): ResponseEntity<List<MyInvitation>> =
        ResponseEntity.ok(people.invitationsSentBy(user().email))

    private fun user() = CurrentUser.current() ?: throw ApiProblem(ProblemCode.UNAUTHENTICATED)
}

// `Me` as `GET /me` answers it; accepting a legal document answers the same.
@Component
class MeResponses(private val people: PeopleService, private val legal: LegalService) {
    fun of(user: CurrentUser): Me {
        val profile = people.profile(user.email)
        val notices = legal.notices(user.email)
        return Me(
            profile.id,
            user.email,
            profile.displayName,
            profile.customName,
            user.access.admin,
            user.access.canCreateTrees,
            Permission.entries.filter { it in user.permissions }.map { ApiPermission.fromValue(it.key) },
            user.verified,
            notices.pending,
            notices.announced,
        )
    }
}
