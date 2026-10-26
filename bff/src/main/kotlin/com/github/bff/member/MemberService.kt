package com.github.bff.member

import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.ParentLink
import com.github.bff.generated.model.Partnership
import com.github.bff.generated.model.Placement
import com.github.bff.generated.model.Position
import com.github.bff.generated.model.Relatives
import jakarta.persistence.EntityManager
import jakarta.persistence.LockModeType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.orm.ObjectOptimisticLockingFailureException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@Service
@Transactional(readOnly = true)
class MemberService(
    private val familyRepository: FamilyRepository,
    private val memberRepository: MemberRepository,
    private val jdbc: JdbcTemplate,
    private val entityManager: EntityManager,
) {
    fun findAll(familyId: UUID): List<Member>? {
        if (!familyRepository.existsById(familyId)) return null
        val photos = photoTimes(familyId)
        val partnerships = partnerships(familyId)
        val parentLinks = parentLinks(familyId)
        return memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(familyId)
            .map { it.toResponse(photos[it.id], partnerships[it.id].orEmpty(), parentLinks[it.id].orEmpty()) }
    }

    @Transactional
    fun create(familyId: UUID, request: CreateMemberRequest): Member? {
        val family = familyRepository.findById(familyId).orElse(null) ?: return null
        return memberRepository.save(
            MemberEntity(
                firstName = request.firstName.trim(),
                lastName = request.lastName.trim(),
                birthName = request.birthName,
                family = family,
                birthDate = request.birthDate,
                birthPlace = request.birthPlace,
                deathDate = request.deathDate,
                deathPlace = request.deathPlace,
                note = request.note,
                photoUrl = request.photoUrl?.toString(),
            ),
        ).toResponse(null, emptyList(), emptyList())
    }

    /**
     * Replaces the member's fields but keeps its parent/child links; null when it is not in the family. With a version,
     * throws ObjectOptimisticLockingFailureException when the member changed since then.
     */
    @Transactional
    fun update(familyId: UUID, id: UUID, request: CreateMemberRequest, version: Long? = null): Member? {
        val entity = memberRepository.findByIdAndFamilyId(id, familyId) ?: return null
        entity.requireVersion(version)
        entity.firstName = request.firstName.trim()
        entity.lastName = request.lastName.trim()
        entity.birthName = request.birthName
        entity.birthDate = request.birthDate
        entity.birthPlace = request.birthPlace
        entity.deathDate = request.deathDate
        entity.deathPlace = request.deathPlace
        entity.note = request.note
        entity.photoUrl = request.photoUrl?.toString()
        // Writes now, so the answer carries the raised version.
        memberRepository.flush()
        return entity.toResponse(
            photoTimes(familyId)[id],
            partnerships(familyId)[id].orEmpty(),
            parentLinks(familyId)[id].orEmpty(),
        )
    }

    @Transactional
    fun updateRelatives(familyId: UUID, id: UUID, relatives: Relatives): RelativesResult {
        val all = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(familyId).associateBy { it.id }
        val member = all[id] ?: return RelativesResult.NOT_FOUND
        member.requireVersion(relatives.version)
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
        val partnerships = relatives.partnerships?.associateBy { it.partnerId }
        if (partnerships != null && (partnerships.size != relatives.partnerships?.size || !partnerIds.containsAll(partnerships.keys))) {
            return RelativesResult.INVALID
        }
        if (partnerships?.values?.any { !it.hasPossibleDates() } == true) return RelativesResult.INVALID
        val parentKinds = relatives.parentLinks?.associate { it.parentId to it.kind }
        if (parentKinds != null && (parentKinds.size != relatives.parentLinks?.size || !parentIds.containsAll(parentKinds.keys))) {
            return RelativesResult.INVALID
        }
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

        val linksBefore = linksByMember(familyId)
        all.values.forEach { other ->
            if (other.id in childIds) other.parents.add(member) else other.parents.remove(member)
            if (takesSiblingParents(other.id)) {
                other.parents.removeIf { it.id in parentIds }
                other.parents.addAll(siblings?.get(other.id).orEmpty().map(all::getValue))
            }
            if (other.id in partnerIds) other.partners.add(member) else other.partners.remove(member)
        }
        // Changed in place, so the rows of kept parents and their kinds stay.
        member.parents.removeIf { it.id !in parentIds }
        member.parents.addAll(parentIds.map(all::getValue))
        // Changed in place, so the rows of kept partners and their details stay.
        member.partners.removeIf { it.id !in partnerIds }
        member.partners.addAll(partnerIds.map(all::getValue))
        // The details below are written with JDBC, which needs the link rows to exist.
        memberRepository.flush()
        if (parentKinds != null) {
            parentIds.forEach { parentId ->
                jdbc.update(
                    "UPDATE member_parents SET kind = ? WHERE child_id = ? AND parent_id = ?",
                    (parentKinds[parentId] ?: ParentLink.KindEnum.BIOLOGICAL).value,
                    id, parentId,
                )
            }
        }
        if (partnerships != null) {
            partnerIds.forEach { partnerId ->
                val partnership = partnerships[partnerId]
                val status = partnership?.status ?: Partnership.StatusEnum.TOGETHER
                // Each status keeps only the dates that belong to it.
                val together = status == Partnership.StatusEnum.TOGETHER
                val married = status in MARRIED_DATES
                val ended = status in ENDED_DATES
                jdbc.update(
                    "UPDATE member_partners SET status = ?, since = ?, married_on = ?, ended_on = ? " +
                        "WHERE (member_id = ? AND partner_id = ?) OR (member_id = ? AND partner_id = ?)",
                    status.value,
                    partnership?.since.takeIf { together },
                    partnership?.marriedOn.takeIf { married },
                    partnership?.endedOn.takeIf { ended },
                    id, partnerId, partnerId, id,
                )
            }
        }
        // Everyone whose own links changed sees different relatives now, so an edit they had open is stale. Fails
        // when one of them was saved by someone else in the meantime.
        val linksAfter = linksByMember(familyId)
        (linksBefore.keys + linksAfter.keys).filter { linksBefore[it] != linksAfter[it] }.forEach { changedId ->
            entityManager.lock(all.getValue(changedId), LockModeType.PESSIMISTIC_FORCE_INCREMENT)
        }
        return RelativesResult.UPDATED
    }

    private fun MemberEntity.requireVersion(expected: Long?) {
        if (expected != null && expected != version) throw ObjectOptimisticLockingFailureException(MemberEntity::class.java, id)
    }

    // Per member everything about its own links that its relatives form shows: its parents and children with their
    // kinds, and its partners with status and dates.
    private fun linksByMember(familyId: UUID): Map<UUID, Set<Any>> {
        val links = mutableMapOf<UUID, MutableSet<Any>>()
        parentLinks(familyId).forEach { (childId, parents) ->
            parents.forEach { link ->
                links.getOrPut(childId, ::mutableSetOf).add(link)
                links.getOrPut(link.parentId, ::mutableSetOf).add(childId to link.kind)
            }
        }
        partnerships(familyId).forEach { (memberId, partnerships) -> links.getOrPut(memberId, ::mutableSetOf).addAll(partnerships) }
        return links
    }

    private companion object {
        // The statuses that keep a wedding date, and those that keep when the partnership ended.
        val MARRIED_DATES = setOf(Partnership.StatusEnum.MARRIED, Partnership.StatusEnum.DIVORCED, Partnership.StatusEnum.WIDOWED)
        val ENDED_DATES = setOf(Partnership.StatusEnum.SEPARATED, Partnership.StatusEnum.DIVORCED, Partnership.StatusEnum.WIDOWED)
    }

    // Dates cannot lie in the future (a day of slack for clients in a later time zone), and a divorce cannot
    // come before the wedding. Only the dates the status keeps count.
    private fun Partnership.hasPossibleDates(): Boolean {
        val latest = LocalDate.now().plusDays(1)
        val since = since.takeIf { status == Partnership.StatusEnum.TOGETHER }
        val married = marriedOn.takeIf { status in MARRIED_DATES }
        val ended = endedOn.takeIf { status in ENDED_DATES }
        if (listOfNotNull(since, married, ended).any { it.isAfter(latest) }) return false
        return married == null || ended == null || !ended.isBefore(married)
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

    fun findPhoto(familyId: UUID, id: UUID): Photo? =
        jdbc.query(
            "SELECT p.content_type, p.data FROM member_photos p JOIN members m ON m.id = p.member_id WHERE p.member_id = ? AND m.family_id = ?",
            { rs, _ -> Photo(rs.getString(1), rs.getBytes(2)) },
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

    // Per member the details of each partner, for the whole family at once.
    private fun partnerships(familyId: UUID): Map<UUID, List<Partnership>> =
        jdbc.query(
            "SELECT p.member_id, p.partner_id, p.status, p.since, p.married_on, p.ended_on " +
                "FROM member_partners p JOIN members m ON m.id = p.member_id WHERE m.family_id = ?",
            { rs, _ ->
                rs.getObject(1, UUID::class.java) to
                    Partnership(rs.getObject(2, UUID::class.java), Partnership.StatusEnum.fromValue(rs.getString(3)))
                        .since(rs.getObject(4, LocalDate::class.java))
                        .marriedOn(rs.getObject(5, LocalDate::class.java))
                        .endedOn(rs.getObject(6, LocalDate::class.java))
            },
            familyId,
        ).groupBy({ it.first }, { it.second })

    // Per child the kind of each parent link, for the whole family at once.
    private fun parentLinks(familyId: UUID): Map<UUID, List<ParentLink>> =
        jdbc.query(
            "SELECT p.child_id, p.parent_id, p.kind FROM member_parents p JOIN members m ON m.id = p.child_id WHERE m.family_id = ?",
            { rs, _ ->
                rs.getObject(1, UUID::class.java) to
                    ParentLink(rs.getObject(2, UUID::class.java), ParentLink.KindEnum.fromValue(rs.getString(3)))
            },
            familyId,
        ).groupBy({ it.first }, { it.second })

    private fun MemberEntity.toResponse(
        photoUpdatedAt: OffsetDateTime?,
        partnerships: List<Partnership>,
        parentLinks: List<ParentLink>,
    ) = Member().apply {
        id = this@toResponse.id
        version = this@toResponse.version ?: 0
        firstName = this@toResponse.firstName
        lastName = this@toResponse.lastName
        birthName = this@toResponse.birthName
        birthDate = this@toResponse.birthDate
        birthPlace = this@toResponse.birthPlace
        deathDate = this@toResponse.deathDate
        deathPlace = this@toResponse.deathPlace
        note = this@toResponse.note
        photoUrl = this@toResponse.photoUrl?.let(URI::create)
        this.photoUpdatedAt = photoUpdatedAt
        parentIds = this@toResponse.parents.map { it.id }
        this.parentLinks = parentLinks
        partnerIds = this@toResponse.partners.map { it.id }
        this.partnerships = partnerships
        pinId = this@toResponse.pinId
        position = posX?.let { Position(it, posY, posZ) }
    }
}

enum class RelativesResult { UPDATED, INVALID, NOT_FOUND }

enum class PlacementResult { UPDATED, INVALID, NOT_FOUND, PIN_TAKEN }

enum class PhotoResult { UPDATED, INVALID, NOT_FOUND, TOO_LARGE, UNSUPPORTED_TYPE }

class Photo(val contentType: String, val data: ByteArray)

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
