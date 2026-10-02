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
        ResponseEntity.ok(memberService.findAll())

    override fun createMember(createMemberRequest: CreateMemberRequest): ResponseEntity<Member> =
        ResponseEntity.status(HttpStatus.CREATED).body(memberService.create(createMemberRequest))

    override fun updateMember(id: UUID, createMemberRequest: CreateMemberRequest): ResponseEntity<Member> =
        memberService.update(id, createMemberRequest)?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()

    override fun updateMemberRelatives(id: UUID, relatives: Relatives): ResponseEntity<Void> =
        when (memberService.updateRelatives(id, relatives)) {
            RelativesResult.UPDATED -> ResponseEntity.noContent().build()
            RelativesResult.INVALID -> ResponseEntity.badRequest().build()
            RelativesResult.NOT_FOUND -> ResponseEntity.notFound().build()
        }

    override fun deleteMember(id: UUID): ResponseEntity<Void> =
        if (memberService.delete(id)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()
}
