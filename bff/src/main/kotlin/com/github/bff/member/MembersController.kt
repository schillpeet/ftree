package com.github.bff.member

import com.github.bff.generated.api.MembersApi
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Relatives
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
class MembersController(private val memberService: MemberService) : MembersApi {
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

    override fun deleteFamilyMember(familyId: UUID, id: UUID): ResponseEntity<Void> =
        if (memberService.delete(familyId, id)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()

    private fun relativesResponse(result: RelativesResult): ResponseEntity<Void> =
        when (result) {
            RelativesResult.UPDATED -> ResponseEntity.noContent().build()
            RelativesResult.INVALID -> ResponseEntity.badRequest().build()
            RelativesResult.NOT_FOUND -> ResponseEntity.notFound().build()
        }
}
