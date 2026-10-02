package com.github.bff.member

import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Relatives
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

    /** Replaces the member's fields but keeps its parent/child links; null when the member does not exist. */
    @Transactional
    fun update(id: UUID, request: CreateMemberRequest): Member? {
        val entity = memberRepository.findById(id).orElse(null) ?: return null
        entity.firstName = request.firstName
        entity.lastName = request.lastName
        entity.birthDate = request.birthDate
        entity.birthPlace = request.birthPlace
        entity.deathDate = request.deathDate
        entity.deathPlace = request.deathPlace
        entity.note = request.note
        entity.photoUrl = request.photoUrl?.toString()
        return entity.toResponse()
    }

    @Transactional
    fun updateRelatives(id: UUID, relatives: Relatives): RelativesResult {
        // ponytail: loads every member to check for cycles; fine for one family, query the graph if trees grow large.
        val all = memberRepository.findAll().associateBy { it.id }
        val member = all[id] ?: return RelativesResult.NOT_FOUND
        val parentIds = relatives.parentIds.toSet()
        val childIds = relatives.childIds.toSet()
        if (id in parentIds || id in childIds || parentIds.any { it in childIds } || !all.keys.containsAll(parentIds + childIds)) {
            return RelativesResult.INVALID
        }

        // Check the links as they would be after the update before changing any entity.
        val parentsOf = all.mapValues { (otherId, other) ->
            when {
                otherId == id -> parentIds
                otherId in childIds -> other.parents.map { it.id }.toSet() + id
                else -> other.parents.map { it.id }.toSet() - id
            }
        }
        if (hasCycle(parentsOf)) return RelativesResult.INVALID

        member.parents = parentIds.map(all::getValue).toMutableSet()
        all.values.forEach { other ->
            if (other.id in childIds) other.parents.add(member) else other.parents.remove(member)
        }
        return RelativesResult.UPDATED
    }

    @Transactional
    fun delete(id: UUID): Boolean {
        val member = memberRepository.findById(id).orElse(null) ?: return false
        memberRepository.findAllByParentsId(id).forEach { it.parents.remove(member) }
        memberRepository.delete(member)
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
        parentIds = this@toResponse.parents.map { it.id }
    }
}

enum class RelativesResult { UPDATED, INVALID, NOT_FOUND }

/** True if following parent links from some member leads back to that member. */
internal fun hasCycle(parentsOf: Map<UUID, Set<UUID>>): Boolean {
    val done = mutableSetOf<UUID>()
    val path = mutableSetOf<UUID>()
    fun visit(id: UUID): Boolean {
        if (id in done) return false
        if (!path.add(id)) return true
        val cyclic = parentsOf[id].orEmpty().any(::visit)
        path.remove(id)
        done.add(id)
        return cyclic
    }
    return parentsOf.keys.any(::visit)
}
