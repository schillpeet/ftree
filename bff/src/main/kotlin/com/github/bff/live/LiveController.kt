package com.github.bff.live

import com.github.bff.auth.CurrentUser
import com.github.bff.generated.api.LiveApi
import com.github.bff.generated.model.PresenceUpdate
import com.github.bff.generated.model.ProblemCode
import com.github.bff.member.FamilyRepository
import com.github.bff.member.MemberRepository
import com.github.bff.problem.ApiProblem
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseEntity
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.UUID

// SecurityConfiguration requires tree.view and FamilyVisibilityInterceptor hides other families; admins may name any
// id, so the family's existence is checked here.
@RestController
@EnableScheduling
class LiveController(
    private val familyRepository: FamilyRepository,
    private val memberRepository: MemberRepository,
    private val presence: PresenceRegistry,
    private val broadcaster: TreeEventBroadcaster,
) : LiveApi {
    override fun streamFamilyEvents(familyId: UUID, clientId: String): ResponseEntity<SseEmitter> {
        val user = existingFamilyUser(familyId)
        return ResponseEntity.ok()
            // Without no-transform, Next's /api rewrite gzips the stream and holds every event until it ends.
            .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-transform")
            .header("X-Accel-Buffering", "no")
            .body(broadcaster.subscribe(familyId, user, clientId))
    }

    override fun updateFamilyPresence(familyId: UUID, presenceUpdate: PresenceUpdate): ResponseEntity<Void> {
        val user = existingFamilyUser(familyId)
        // Others see these ids, so they must be members of this family.
        val members = listOfNotNull(presenceUpdate.viewing, presenceUpdate.editing).toSet()
        if (!members.all { memberRepository.existsByIdAndFamilyId(it, familyId) }) throw ApiProblem(ProblemCode.INVALID_REQUEST)
        val changed = presence.update(
            familyId,
            presenceUpdate.clientId,
            user.email,
            user.access.admin,
            presenceUpdate.viewing,
            presenceUpdate.editing,
            presenceUpdate.idle,
        )
        if (changed) broadcaster.sendPresence(familyId)
        return ResponseEntity.noContent().build()
    }

    private fun existingFamilyUser(familyId: UUID): CurrentUser {
        val user = CurrentUser.current() ?: throw ApiProblem(ProblemCode.UNAUTHENTICATED)
        if (!familyRepository.existsById(familyId)) throw ApiProblem(ProblemCode.NOT_FOUND)
        return user
    }
}
