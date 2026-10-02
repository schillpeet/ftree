package com.github.bff.member

import com.github.bff.generated.api.MembersApi
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Position
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

    override fun updateMemberPosition(id: UUID, position: Position): ResponseEntity<Member> =
        memberService.updatePosition(id, position)?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()

    override fun deleteMember(id: UUID): ResponseEntity<Void> =
        if (memberService.delete(id)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()
}
