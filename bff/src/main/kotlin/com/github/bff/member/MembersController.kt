package com.github.bff.member

import com.github.bff.generated.api.MembersApi
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Placement
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.Relatives
import com.github.bff.generated.model.UpdateMemberRequest
import com.github.bff.problem.ApiProblem
import jakarta.servlet.http.HttpServletRequest
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.Resource
import org.springframework.http.CacheControl
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.util.UUID

@RestController
class MembersController(
    private val memberService: MemberService,
    // Request-scoped proxy; the generated interface does not pass the body's Content-Type.
    private val request: HttpServletRequest,
) : MembersApi {
    override fun getFamilyMembers(familyId: UUID): ResponseEntity<List<Member>> =
        memberService.findAll(familyId)?.let { ResponseEntity.ok(it) } ?: throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun createFamilyMember(
        familyId: UUID,
        createMemberRequest: CreateMemberRequest,
    ): ResponseEntity<Member> =
        memberService.create(familyId, createMemberRequest)?.let { ResponseEntity.status(HttpStatus.CREATED).body(it) }
            ?: throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun updateFamilyMember(
        familyId: UUID,
        id: UUID,
        updateMemberRequest: UpdateMemberRequest,
    ): ResponseEntity<Member> =
        memberService.update(familyId, id, updateMemberRequest.toCreateRequest(), updateMemberRequest.version)?.let { ResponseEntity.ok(it) }
            ?: throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun updateFamilyMemberRelatives(
        familyId: UUID,
        id: UUID,
        relatives: Relatives,
    ): ResponseEntity<Void> =
        relativesResponse(memberService.updateRelatives(familyId, id, relatives))

    override fun updateFamilyMemberPlacement(
        familyId: UUID,
        id: UUID,
        placement: Placement,
    ): ResponseEntity<Void> =
        when (memberService.updatePlacement(familyId, id, placement)) {
            PlacementResult.UPDATED -> ResponseEntity.noContent().build()
            PlacementResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            PlacementResult.NOT_FOUND -> throw ApiProblem(ProblemCode.NOT_FOUND)
            PlacementResult.PIN_TAKEN -> throw ApiProblem(ProblemCode.PIN_TAKEN)
        }

    override fun uploadFamilyMemberPhoto(familyId: UUID, id: UUID, body: Resource): ResponseEntity<Void> =
        when (memberService.updatePhoto(familyId, id, request.contentType, body.contentAsByteArray)) {
            PhotoResult.UPDATED -> ResponseEntity.noContent().build()
            PhotoResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            PhotoResult.NOT_FOUND -> throw ApiProblem(ProblemCode.NOT_FOUND)
            PhotoResult.TOO_LARGE -> throw ApiProblem(ProblemCode.PHOTO_TOO_LARGE)
            PhotoResult.UNSUPPORTED_TYPE -> throw ApiProblem(ProblemCode.UNSUPPORTED_MEDIA_TYPE)
        }

    override fun getFamilyMemberPhoto(familyId: UUID, id: UUID): ResponseEntity<Resource> =
        memberService.findPhoto(familyId, id)?.let { photo ->
            ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .body<Resource>(ByteArrayResource(photo.data))
        } ?: throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun deleteFamilyMemberPhoto(familyId: UUID, id: UUID): ResponseEntity<Void> =
        if (memberService.deletePhoto(familyId, id)) ResponseEntity.noContent().build() else throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun deleteFamilyMember(familyId: UUID, id: UUID): ResponseEntity<Void> =
        if (memberService.delete(familyId, id)) ResponseEntity.noContent().build() else throw ApiProblem(ProblemCode.NOT_FOUND)

    // The generator flattens UpdateMemberRequest instead of extending CreateMemberRequest.
    private fun UpdateMemberRequest.toCreateRequest() =
        CreateMemberRequest(firstName, lastName)
            .birthName(birthName)
            .birthDate(birthDate)
            .birthPlace(birthPlace)
            .deathDate(deathDate)
            .deathPlace(deathPlace)
            .note(note)
            .photoUrl(photoUrl)

    private fun relativesResponse(result: RelativesResult): ResponseEntity<Void> =
        when (result) {
            RelativesResult.UPDATED -> ResponseEntity.noContent().build()
            RelativesResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            RelativesResult.NOT_FOUND -> throw ApiProblem(ProblemCode.NOT_FOUND)
        }
}
