package com.github.bff.member

import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Placement
import com.github.bff.generated.model.Position
import com.github.bff.generated.model.Relatives
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.util.UUID

@Service
@Transactional(readOnly = true)
class MemberService(
    private val familyRepository: FamilyRepository,
    private val memberRepository: MemberRepository,
) {
    fun findDefaultFamilyMembers(): List<Member> =
        familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)
            ?.let { memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(it.id).map { member -> member.toResponse() } }
            .orEmpty()

    @Transactional
    fun createDefaultFamilyMember(request: CreateMemberRequest): Member? =
        familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)
            ?.let { create(it.id, request) }

    @Transactional
    fun updateDefaultFamilyMember(id: UUID, request: CreateMemberRequest): Member? =
        familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)
            ?.let { update(it.id, id, request) }

    @Transactional
    fun updateDefaultFamilyMemberRelatives(id: UUID, relatives: Relatives): RelativesResult =
        familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)
            ?.let { updateRelatives(it.id, id, relatives) }
            ?: RelativesResult.NOT_FOUND

    @Transactional
    fun deleteDefaultFamilyMember(id: UUID): Boolean =
        familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)
            ?.let { delete(it.id, id) }
            ?: false

    fun findAll(familyId: UUID): List<Member>? {
        if (!familyRepository.existsById(familyId)) return null
        return memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(familyId).map { it.toResponse() }
    }

    @Transactional
    fun create(familyId: UUID, request: CreateMemberRequest): Member? {
        val family = familyRepository.findById(familyId).orElse(null) ?: return null
        return memberRepository.save(
            MemberEntity(
                firstName = request.firstName,
                lastName = request.lastName,
                family = family,
                birthDate = request.birthDate,
                birthPlace = request.birthPlace,
                deathDate = request.deathDate,
                deathPlace = request.deathPlace,
                note = request.note,
                photoUrl = request.photoUrl?.toString(),
            ),
        ).toResponse()
    }

    /** Replaces the member's fields but keeps its parent/child links; null when it is not in the family. */
    @Transactional
    fun update(familyId: UUID, id: UUID, request: CreateMemberRequest): Member? {
        val entity = memberRepository.findByIdAndFamilyId(id, familyId) ?: return null
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
    fun updateRelatives(familyId: UUID, id: UUID, relatives: Relatives): RelativesResult {
        val all = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(familyId).associateBy { it.id }
        val member = all[id] ?: return RelativesResult.NOT_FOUND
        val parentIds = relatives.parentIds.toSet()
        val childIds = relatives.childIds.toSet()
        val partnerIds = relatives.partnerIds.toSet()
        val everyone = parentIds + childIds + partnerIds
        if (id in everyone || everyone.size != parentIds.size + childIds.size + partnerIds.size || !all.keys.containsAll(everyone)) {
            return RelativesResult.INVALID
        }

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
            if (other.id in partnerIds) other.partners.add(member) else other.partners.remove(member)
        }
        member.partners = partnerIds.map(all::getValue).toMutableSet()
        return RelativesResult.UPDATED
    }

    /** Pins the member's card or places it freely; exactly one of pinId and position must be set. */
    @Transactional
    fun updatePlacement(familyId: UUID, id: UUID, placement: Placement): PlacementResult {
        val pinId = placement.pinId
        val position = placement.position
        if ((pinId == null) == (position == null) || (pinId != null && pinId < 0)) return PlacementResult.INVALID
        val member = memberRepository.findByIdAndFamilyId(id, familyId) ?: return PlacementResult.NOT_FOUND
        if (pinId != null && memberRepository.existsByFamilyIdAndPinIdAndIdNot(familyId, pinId, id)) {
            return PlacementResult.PIN_TAKEN
        }
        member.pinId = pinId
        member.posX = position?.x
        member.posY = position?.y
        member.posZ = position?.z
        return PlacementResult.UPDATED
    }

    @Transactional
    fun delete(familyId: UUID, id: UUID): Boolean {
        val member = memberRepository.findByIdAndFamilyId(id, familyId) ?: return false
        memberRepository.findAllByFamilyIdAndParentsId(familyId, id).forEach { it.parents.remove(member) }
        memberRepository.findAllByFamilyIdAndPartnersId(familyId, id).forEach { it.partners.remove(member) }
        member.parents.clear()
        member.partners.clear()
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
        partnerIds = this@toResponse.partners.map { it.id }
        pinId = this@toResponse.pinId
        position = posX?.let { Position(it, posY, posZ) }
    }
}

enum class RelativesResult { UPDATED, INVALID, NOT_FOUND }

enum class PlacementResult { UPDATED, INVALID, NOT_FOUND, PIN_TAKEN }

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
