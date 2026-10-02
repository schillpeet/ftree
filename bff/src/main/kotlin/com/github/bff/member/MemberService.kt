package com.github.bff.member

import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Position
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.util.UUID

@Service
@Transactional(readOnly = true)
class MemberService(private val memberRepository: MemberRepository) {
    fun findAll(): List<Member> = memberRepository
        .findAll(Sort.by("lastName", "firstName"))
        .map { it.toResponse() }

    @Transactional
    fun create(request: CreateMemberRequest): Member {
        val entity = MemberEntity(
            firstName = request.firstName,
            lastName = request.lastName,
            birthDate = request.birthDate,
            birthPlace = request.birthPlace,
            deathDate = request.deathDate,
            deathPlace = request.deathPlace,
            note = request.note,
            photoUrl = request.photoUrl?.toString(),
        )
        return memberRepository.save(entity).toResponse()
    }

    @Transactional
    fun updatePosition(id: UUID, position: Position): Member? {
        val entity = memberRepository.findById(id).orElse(null) ?: return null
        entity.positionX = position.x
        entity.positionY = position.y
        entity.positionZ = position.z
        return memberRepository.save(entity).toResponse()
    }

    @Transactional
    fun delete(id: UUID): Boolean {
        if (!memberRepository.existsById(id)) return false
        memberRepository.deleteById(id)
        return true
    }

    private fun MemberEntity.toResponse() = Member().apply {
        id = this@toResponse.id
        firstName = this@toResponse.firstName
        lastName = this@toResponse.lastName
        birthDate = this@toResponse.birthDate
        birthPlace = this@toResponse.birthPlace
        deathDate = this@toResponse.deathDate
        deathPlace = this@toResponse.deathPlace
        note = this@toResponse.note
        photoUrl = this@toResponse.photoUrl?.let(URI::create)
        val x = positionX
        val y = positionY
        val z = positionZ
        if (x != null && y != null && z != null) position = Position(x, y, z)
    }
}
