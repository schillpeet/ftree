package com.github.bff.member

import com.github.bff.generated.api.MembersApi
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class MembersController(private val memberService: MemberService) : MembersApi {
    override fun getMembers(): ResponseEntity<List<Member>> =
        ResponseEntity.ok(memberService.findAll())

    override fun createMember(createMemberRequest: CreateMemberRequest): ResponseEntity<Member> =
        ResponseEntity.status(HttpStatus.CREATED).body(memberService.create(createMemberRequest))
}
