package com.github.bff.member

import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Placement
import com.github.bff.generated.model.Position
import com.github.bff.generated.model.Relatives
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.time.OffsetDateTime
import java.util.UUID

@Service
@Transactional(readOnly = true)
class MemberService(
    private val familyRepository: FamilyRepository,
    private val memberRepository: MemberRepository,
    private val jdbc: JdbcTemplate,
) {
    fun findDefaultFamilyMembers(): List<Member> =
        familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)?.let { findAll(it.id) }.orEmpty()

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
        val photos = photoTimes(familyId)
        return memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(familyId).map { it.toResponse(photos[it.id]) }
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
        ).toResponse(null)
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
        return entity.toResponse(photoTimes(familyId)[id])
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
        // Siblings are not stored but derived from shared parents, so they must share some of the new parents.
        val siblings = relatives.siblings?.associate { it.id to it.parentIds.toSet() }
        val invalidSiblings = siblings != null && (
            siblings.size != relatives.siblings?.size ||
                siblings.any { (siblingId, shared) ->
                    siblingId == id || siblingId in everyone || siblingId !in all || shared.isEmpty() || !parentIds.containsAll(shared)
                }
            )
        if (invalidSiblings) return RelativesResult.INVALID
        // Listed siblings get exactly their shared parents among the member's; everyone else outside the
        // member's own relatives loses the member's parents.
        val takesSiblingParents = { otherId: UUID -> siblings != null && otherId != id && otherId !in everyone }

        val parentsOf = all.mapValues { (otherId, other) ->
            val current = other.parents.map { it.id }.toSet()
            when {
                otherId == id -> parentIds
                otherId in childIds -> current + id
                takesSiblingParents(otherId) -> current - id - parentIds + siblings?.get(otherId).orEmpty()
                else -> current - id
            }
        }
        if (hasCycle(parentsOf)) return RelativesResult.INVALID

        member.parents = parentIds.map(all::getValue).toMutableSet()
        all.values.forEach { other ->
            if (other.id in childIds) other.parents.add(member) else other.parents.remove(member)
            if (takesSiblingParents(other.id)) {
                other.parents.removeIf { it.id in parentIds }
                other.parents.addAll(siblings?.get(other.id).orEmpty().map(all::getValue))
            }
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

    /** Stores or replaces the member's photo; only JPEG, PNG, and WebP up to MAX_PHOTO_BYTES. */
    @Transactional
    fun updatePhoto(familyId: UUID, id: UUID, contentType: String?, data: ByteArray): PhotoResult {
        val type = contentType?.substringBefore(';')?.trim()?.lowercase()
        if (type !in PHOTO_TYPES) return PhotoResult.UNSUPPORTED_TYPE
        if (data.isEmpty()) return PhotoResult.INVALID
        if (data.size > MAX_PHOTO_BYTES) return PhotoResult.TOO_LARGE
        if (memberRepository.findByIdAndFamilyId(id, familyId) == null) return PhotoResult.NOT_FOUND
        jdbc.update(
            """
            INSERT INTO member_photos (member_id, content_type, data, updated_at) VALUES (?, ?, ?, now())
            ON CONFLICT (member_id) DO UPDATE
                SET content_type = excluded.content_type, data = excluded.data, updated_at = excluded.updated_at
            """,
            id, type, data,
        )
        return PhotoResult.UPDATED
    }

    fun findPhoto(familyId: UUID, id: UUID): MemberPhoto? =
        jdbc.query(
            "SELECT p.content_type, p.data FROM member_photos p JOIN members m ON m.id = p.member_id WHERE p.member_id = ? AND m.family_id = ?",
            { rs, _ -> MemberPhoto(rs.getString(1), rs.getBytes(2)) },
            id, familyId,
        ).firstOrNull()

    @Transactional
    fun deletePhoto(familyId: UUID, id: UUID): Boolean =
        jdbc.update(
            "DELETE FROM member_photos p USING members m WHERE m.id = p.member_id AND p.member_id = ? AND m.family_id = ?",
            id, familyId,
        ) > 0

    // One query for the whole family instead of one per member; never loads the bytes.
    private fun photoTimes(familyId: UUID): Map<UUID, OffsetDateTime> =
        jdbc.query(
            "SELECT p.member_id, p.updated_at FROM member_photos p JOIN members m ON m.id = p.member_id WHERE m.family_id = ?",
            { rs, _ -> rs.getObject(1, UUID::class.java) to rs.getObject(2, OffsetDateTime::class.java) },
            familyId,
        ).toMap()

    private fun MemberEntity.toResponse(photoUpdatedAt: OffsetDateTime?) = Member().apply {
        id = this@toResponse.id
        firstName = this@toResponse.firstName
        lastName = this@toResponse.lastName
        birthDate = this@toResponse.birthDate
        birthPlace = this@toResponse.birthPlace
        deathDate = this@toResponse.deathDate
        deathPlace = this@toResponse.deathPlace
        note = this@toResponse.note
        photoUrl = this@toResponse.photoUrl?.let(URI::create)
        this.photoUpdatedAt = photoUpdatedAt
        parentIds = this@toResponse.parents.map { it.id }
        partnerIds = this@toResponse.partners.map { it.id }
        pinId = this@toResponse.pinId
        position = posX?.let { Position(it, posY, posZ) }
    }
}

enum class RelativesResult { UPDATED, INVALID, NOT_FOUND }

enum class PlacementResult { UPDATED, INVALID, NOT_FOUND, PIN_TAKEN }

enum class PhotoResult { UPDATED, INVALID, NOT_FOUND, TOO_LARGE, UNSUPPORTED_TYPE }

class MemberPhoto(val contentType: String, val data: ByteArray)

internal const val MAX_PHOTO_BYTES = 2 * 1024 * 1024
internal val PHOTO_TYPES = setOf("image/jpeg", "image/png", "image/webp")

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
