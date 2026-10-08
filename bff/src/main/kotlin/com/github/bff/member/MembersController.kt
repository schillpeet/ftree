package com.github.bff.member

import com.github.bff.generated.api.MembersApi
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Placement
import com.github.bff.generated.model.Relatives
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
    override fun getMembers(): ResponseEntity<List<Member>> =
        ResponseEntity.ok(memberService.findDefaultFamilyMembers())

    override fun createMember(createMemberRequest: CreateMemberRequest): ResponseEntity<Member> =
        memberService.createDefaultFamilyMember(createMemberRequest)
            ?.let { ResponseEntity.status(HttpStatus.CREATED).body(it) }
            ?: ResponseEntity.notFound().build()

    override fun updateMember(id: UUID, createMemberRequest: CreateMemberRequest): ResponseEntity<Member> =
        memberService.updateDefaultFamilyMember(id, createMemberRequest)?.let { ResponseEntity.ok(it) }
            ?: ResponseEntity.notFound().build()

    override fun updateMemberRelatives(id: UUID, relatives: Relatives): ResponseEntity<Void> =
        relativesResponse(memberService.updateDefaultFamilyMemberRelatives(id, relatives))

    override fun deleteMember(id: UUID): ResponseEntity<Void> =
        if (memberService.deleteDefaultFamilyMember(id)) ResponseEntity.noContent().build()
        else ResponseEntity.notFound().build()

    override fun getFamilyMembers(familyId: UUID): ResponseEntity<List<Member>> =
        memberService.findAll(familyId)?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()

    override fun createFamilyMember(
        familyId: UUID,
        createMemberRequest: CreateMemberRequest,
    ): ResponseEntity<Member> =
        memberService.create(familyId, createMemberRequest)?.let { ResponseEntity.status(HttpStatus.CREATED).body(it) }
            ?: ResponseEntity.notFound().build()

    override fun updateFamilyMember(
        familyId: UUID,
        id: UUID,
        createMemberRequest: CreateMemberRequest,
    ): ResponseEntity<Member> =
        memberService.update(familyId, id, createMemberRequest)?.let { ResponseEntity.ok(it) }
            ?: ResponseEntity.notFound().build()

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
            PlacementResult.INVALID -> ResponseEntity.badRequest().build()
            PlacementResult.NOT_FOUND -> ResponseEntity.notFound().build()
            PlacementResult.PIN_TAKEN -> ResponseEntity.status(HttpStatus.CONFLICT).build()
        }

    override fun uploadFamilyMemberPhoto(familyId: UUID, id: UUID, body: Resource): ResponseEntity<Void> =
        when (memberService.updatePhoto(familyId, id, request.contentType, body.contentAsByteArray)) {
            PhotoResult.UPDATED -> ResponseEntity.noContent().build()
            PhotoResult.INVALID -> ResponseEntity.badRequest().build()
            PhotoResult.NOT_FOUND -> ResponseEntity.notFound().build()
            PhotoResult.TOO_LARGE -> ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).build()
            PhotoResult.UNSUPPORTED_TYPE -> ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).build()
        }

    override fun getFamilyMemberPhoto(familyId: UUID, id: UUID): ResponseEntity<Resource> =
        memberService.findPhoto(familyId, id)?.let { photo ->
            ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .body<Resource>(ByteArrayResource(photo.data))
        } ?: ResponseEntity.notFound().build()

    override fun deleteFamilyMemberPhoto(familyId: UUID, id: UUID): ResponseEntity<Void> =
        if (memberService.deletePhoto(familyId, id)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()

    override fun deleteFamilyMember(familyId: UUID, id: UUID): ResponseEntity<Void> =
        if (memberService.delete(familyId, id)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()

    private fun relativesResponse(result: RelativesResult): ResponseEntity<Void> =
        when (result) {
            RelativesResult.UPDATED -> ResponseEntity.noContent().build()
            RelativesResult.INVALID -> ResponseEntity.badRequest().build()
            RelativesResult.NOT_FOUND -> ResponseEntity.notFound().build()
        }
}
