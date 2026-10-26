package com.github.bff.member

import com.github.bff.auth.CurrentUser
import com.github.bff.auth.Memberships
import com.github.bff.auth.Role
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.AnonymizeFamilyRequest
import com.github.bff.generated.model.ArchiveFamilyRequest
import com.github.bff.generated.model.CreateEmptyFamilyRequest
import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.FamilySummary
import com.github.bff.generated.model.ImportFamilyRequest
import com.github.bff.generated.model.ParentLink.KindEnum
import com.github.bff.generated.model.PhotoFit
import com.github.bff.generated.model.RenameFamilyRequest
import com.github.bff.generated.model.ReorderFamiliesRequest
import com.github.bff.generated.model.TestFamilySettings
import com.github.bff.live.TreeEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.math.roundToInt

@Service
@Transactional(readOnly = true)
class FamilyService(
    private val familyRepository: FamilyRepository,
    private val memberRepository: MemberRepository,
    private val jdbc: JdbcTemplate,
    private val memberships: Memberships,
    private val events: ApplicationEventPublisher,
) {
    fun findAll(): List<FamilySummary> {
        val photos = photoTimes()
        return familyRepository.findAllByOrderByPositionAsc().map { family ->
            family.toSummary(memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(family.id), photos[family.id])
        }
    }

    // Accepts only a permutation of every family id, so no family can be dropped from the list.
    @Transactional
    fun reorder(request: ReorderFamiliesRequest): Boolean {
        val ids = request.familyIds.orEmpty()
        val families = familyRepository.findAll().associateBy { it.id }
        if (ids.size != families.size || ids.toSet() != families.keys) return false
        ids.forEachIndexed { index, id -> families.getValue(id).position = index }
        return true
    }

    @Transactional
    fun create(request: CreateFamilyRequest): FamilyCreationResult {
        val name = request.name?.trim().orEmpty()
        val totalUsers = request.totalUsers ?: return FamilyCreationResult.INVALID
        val generationCount = request.generationCount ?: return FamilyCreationResult.INVALID
        val minChildren = request.minChildren ?: return FamilyCreationResult.INVALID
        val maxChildren = request.maxChildren ?: return FamilyCreationResult.INVALID
        if (
            name.isEmpty() || name.length > 100 ||
            totalUsers !in 1..250 ||
            generationCount !in 1..10 ||
            minChildren !in 0..3 ||
            maxChildren !in minChildren..3
        ) {
            return FamilyCreationResult.INVALID
        }
        if (familyRepository.existsByNameIgnoreCase(name)) return FamilyCreationResult.NAME_TAKEN
        val plan = planFamily(totalUsers, generationCount, minChildren, maxChildren)
            ?: return FamilyCreationResult.INVALID

        val family = saveNew(
            FamilyEntity(
                name = name,
                slug = newSlug(name),
                createdBy = creator(),
                totalUsers = totalUsers,
                generationCount = generationCount,
                minChildren = minChildren,
                maxChildren = maxChildren,
            ),
        )
        val members = plan.mapIndexed { index, person ->
            MemberEntity(
                firstName = "Testuser ${String.format("%03d", index + 1)}",
                lastName = "Generation ${person.generation + 1}",
                family = family,
                note = "Automatisch generierter Testuser.",
            )
        }
        plan.forEachIndexed { index, person ->
            person.parentIndex?.let { parentIndex -> members[index].parents.add(members[parentIndex]) }
        }
        val saved = memberRepository.saveAll(members)
        memberRepository.flush()
        return FamilyCreationResult.CREATED(family.toSummary(saved))
    }

    // A real family without members, filled one person at a time.
    @Transactional
    fun createEmpty(request: CreateEmptyFamilyRequest): FamilyCreationResult {
        val name = request.name?.trim().orEmpty()
        if (name.isEmpty() || name.length > 100) return FamilyCreationResult.INVALID
        if (familyRepository.existsByNameIgnoreCase(name)) return FamilyCreationResult.NAME_TAKEN
        val family = saveNew(FamilyEntity(name = name, slug = newSlug(name), createdBy = creator()))
        return FamilyCreationResult.CREATED(family.toSummary(emptyList()))
    }

    // Moves every member, with links and placements, into a new family; the source stays empty.
    @Transactional
    fun archive(id: UUID, request: ArchiveFamilyRequest): FamilyArchiveResult {
        if (!familyRepository.existsById(id)) return FamilyArchiveResult.NOT_FOUND
        val name = request.name?.trim().orEmpty()
        val members = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(id)
        if (name.isEmpty() || name.length > 100 || members.isEmpty()) return FamilyArchiveResult.INVALID
        if (familyRepository.existsByNameIgnoreCase(name)) return FamilyArchiveResult.NAME_TAKEN
        val archived = saveNew(FamilyEntity(name = name, slug = newSlug(name), createdBy = creator()))
        members.forEach { it.family = archived }
        memberRepository.flush()
        changed(id)
        return FamilyArchiveResult.ARCHIVED(archived.toSummary(members))
    }

    // Creates a new family from a GEDCOM file; members get no placement, so the UI pins them.
    @Transactional
    fun import(request: ImportFamilyRequest): FamilyImportResult {
        val name = request.name?.trim().orEmpty()
        if (name.isEmpty() || name.length > 100) return FamilyImportResult.INVALID
        val people = parseGedcom(request.gedcom.orEmpty()) ?: return FamilyImportResult.INVALID
        if (people.isEmpty() || people.size > MAX_IMPORTED_PEOPLE) return FamilyImportResult.INVALID
        val ids = people.associate { it.id to UUID.randomUUID() }
        if (hasCycle(people.associate { person -> ids.getValue(person.id) to person.parentIds.map(ids::getValue).toSet() })) {
            return FamilyImportResult.INVALID
        }
        if (familyRepository.existsByNameIgnoreCase(name)) return FamilyImportResult.NAME_TAKEN

        val family = saveNew(FamilyEntity(name = name, slug = newSlug(name), createdBy = creator()))
        val saved = memberRepository.saveAll(
            people.map { person ->
                MemberEntity(
                    id = ids.getValue(person.id),
                    firstName = person.firstName,
                    lastName = person.lastName,
                    birthName = person.birthName,
                    family = family,
                    birthDate = person.birthDate,
                    birthPlace = person.birthPlace,
                    deathDate = person.deathDate,
                    deathPlace = person.deathPlace,
                    note = person.note,
                )
            },
        ).associateBy { it.id }
        // Links are set on the saved entities; the parser already made partnerships mutual.
        people.forEach { person ->
            val member = saved.getValue(ids.getValue(person.id))
            person.parentIds.mapTo(member.parents) { saved.getValue(ids.getValue(it)) }
            person.partnerIds.mapTo(member.partners) { saved.getValue(ids.getValue(it)) }
        }
        memberRepository.flush()
        // The links above are inserted as biological, so the other kinds are written afterwards.
        val kinds = people.flatMap { person ->
            person.parentKinds.filterValues { it != KindEnum.BIOLOGICAL }.map { (parent, kind) ->
                arrayOf<Any?>(kind.value, ids.getValue(person.id), ids.getValue(parent))
            }
        }
        jdbc.batchUpdate("UPDATE member_parents SET kind = ? WHERE child_id = ? AND parent_id = ?", kinds)
        return FamilyImportResult.IMPORTED(family.toSummary(saved.values.toList()))
    }

    // Copies every member with links, partnership details, and placement into a new family under
    // random names; photos stay behind and the source is not changed.
    @Transactional
    fun anonymize(id: UUID, request: AnonymizeFamilyRequest): FamilyAnonymizeResult {
        if (!familyRepository.existsById(id)) return FamilyAnonymizeResult.NOT_FOUND
        val name = request.name?.trim().orEmpty()
        if (name.isEmpty() || name.length > 100) return FamilyAnonymizeResult.INVALID
        if (familyRepository.existsByNameIgnoreCase(name)) return FamilyAnonymizeResult.NAME_TAKEN

        val originals = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(id)
        val names = AnonymousNames(originals)
        val family = saveNew(FamilyEntity(name = name, slug = newSlug(name), createdBy = creator()))
        val copies = memberRepository.saveAll(
            originals.map { member ->
                MemberEntity(
                    firstName = names.firstName(member.firstName),
                    lastName = names.lastName(member.lastName),
                    birthName = names.birthName(member.birthName),
                    family = family,
                    birthDate = member.birthDate,
                    birthPlace = member.birthPlace,
                    deathDate = member.deathDate,
                    deathPlace = member.deathPlace,
                    note = member.note,
                    pinId = member.pinId,
                    posX = member.posX,
                    posY = member.posY,
                    posZ = member.posZ,
                )
            },
        )
        val copyOf = originals.map { it.id }.zip(copies).toMap()
        originals.zip(copies).forEach { (original, copy) ->
            original.parents.mapTo(copy.parents) { copyOf.getValue(it.id) }
            original.partners.mapTo(copy.partners) { copyOf.getValue(it.id) }
        }
        memberRepository.flush()
        // The links above are inserted with the default status, so the details are copied afterwards.
        val details = jdbc.query(
            "SELECT p.member_id, p.partner_id, p.status, p.since, p.married_on, p.ended_on " +
                "FROM member_partners p JOIN members m ON m.id = p.member_id WHERE m.family_id = ?",
            { rs, _ ->
                arrayOf<Any?>(
                    rs.getString(3),
                    rs.getObject(4, LocalDate::class.java),
                    rs.getObject(5, LocalDate::class.java),
                    rs.getObject(6, LocalDate::class.java),
                    copyOf.getValue(rs.getObject(1, UUID::class.java)).id,
                    copyOf.getValue(rs.getObject(2, UUID::class.java)).id,
                )
            },
            id,
        )
        jdbc.batchUpdate(
            "UPDATE member_partners SET status = ?, since = ?, married_on = ?, ended_on = ? WHERE member_id = ? AND partner_id = ?",
            details,
        )
        // Likewise the parent links are inserted as biological, so their kinds are copied afterwards.
        val kinds = parentLinkKinds(id) { child, parent, kind ->
            arrayOf<Any?>(kind, copyOf.getValue(child).id, copyOf.getValue(parent).id)
        }
        jdbc.batchUpdate("UPDATE member_parents SET kind = ? WHERE child_id = ? AND parent_id = ?", kinds)
        return FamilyAnonymizeResult.ANONYMIZED(family.toSummary(copies))
    }

    @Transactional
    fun rename(id: UUID, request: RenameFamilyRequest): FamilyRenameResult {
        val family = familyRepository.findById(id).orElse(null) ?: return FamilyRenameResult.NOT_FOUND
        val name = request.name?.trim().orEmpty()
        if (name.isEmpty() || name.length > 100) return FamilyRenameResult.INVALID
        if (!name.equals(family.name, ignoreCase = true) && familyRepository.existsByNameIgnoreCase(name)) {
            return FamilyRenameResult.NAME_TAKEN
        }
        family.name = name
        familyRepository.flush()
        changed(id)
        val members = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(id)
        return FamilyRenameResult.RENAMED(family.toSummary(members, photoTimes()[id]))
    }

    @Transactional
    fun setPhotoFit(id: UUID, fit: PhotoFit): FamilySummary? {
        val family = familyRepository.findById(id).orElse(null) ?: return null
        family.photoFit = fit.value
        familyRepository.flush()
        changed(id)
        return family.toSummary(memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(id), photoTimes()[id])
    }

    fun export(id: UUID): FamilyExport? {
        val family = familyRepository.findById(id).orElse(null) ?: return null
        val kinds = parentLinkKinds(id) { child, parent, kind -> Triple(child, parent, KindEnum.fromValue(kind)) }
            .filter { it.third != KindEnum.BIOLOGICAL }
            .groupBy({ it.first }, { it.second to it.third })
        val people = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(id).map { member ->
            GedcomPerson(
                id = member.id.toString(),
                firstName = member.firstName,
                lastName = member.lastName,
                birthDate = member.birthDate,
                birthPlace = member.birthPlace,
                deathDate = member.deathDate,
                deathPlace = member.deathPlace,
                note = member.note,
                parentIds = member.parents.map { it.id.toString() }.toSet(),
                partnerIds = member.partners.map { it.id.toString() }.toSet(),
                birthName = member.birthName,
                parentKinds = kinds[member.id].orEmpty().associate { (parent, kind) -> parent.toString() to kind },
            )
        }
        return FamilyExport(family.name, writeGedcom(people))
    }

    @Transactional
    fun delete(id: UUID): Boolean {
        val family = familyRepository.findById(id).orElse(null) ?: return false
        val members = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(id)
        members.forEach { member ->
            member.parents.clear()
            member.partners.clear()
        }
        memberRepository.flush()
        memberRepository.deleteAll(members)
        familyRepository.delete(family)
        events.publishEvent(TreeEvent.FamilyDeleted(id))
        return true
    }

    /** Stores or replaces the family's photo; only JPEG, PNG, and WebP up to MAX_PHOTO_BYTES. */
    @Transactional
    fun updatePhoto(id: UUID, contentType: String?, data: ByteArray): PhotoResult {
        val type = contentType?.substringBefore(';')?.trim()?.lowercase()
        if (type !in PHOTO_TYPES) return PhotoResult.UNSUPPORTED_TYPE
        if (data.isEmpty()) return PhotoResult.INVALID
        if (data.size > MAX_PHOTO_BYTES) return PhotoResult.TOO_LARGE
        if (!familyRepository.existsById(id)) return PhotoResult.NOT_FOUND
        jdbc.update(
            """
            INSERT INTO family_photos (family_id, content_type, data, updated_at) VALUES (?, ?, ?, now())
            ON CONFLICT (family_id) DO UPDATE
                SET content_type = excluded.content_type, data = excluded.data, updated_at = excluded.updated_at
            """,
            id, type, data,
        )
        changed(id)
        return PhotoResult.UPDATED
    }

    fun findPhoto(id: UUID): Photo? =
        jdbc.query(
            "SELECT content_type, data FROM family_photos WHERE family_id = ?",
            { rs, _ -> Photo(rs.getString(1), rs.getBytes(2)) },
            id,
        ).firstOrNull()

    @Transactional
    fun deletePhoto(id: UUID): Boolean {
        val deleted = jdbc.update("DELETE FROM family_photos WHERE family_id = ?", id) > 0
        if (deleted) changed(id)
        return deleted
    }

    // The family's event streams get it once the transaction has committed.
    private fun changed(id: UUID) = events.publishEvent(TreeEvent.FamilyChanged(id))

    // One query for all families instead of one per family; never loads the bytes.
    private fun photoTimes(): Map<UUID, OffsetDateTime> =
        jdbc.query(
            "SELECT family_id, updated_at FROM family_photos",
            { rs, _ -> rs.getObject(1, UUID::class.java) to rs.getObject(2, OffsetDateTime::class.java) },
        ).toMap()

    // Every parent link of the family's members as (child id, parent id, stored kind).
    private fun <T> parentLinkKinds(familyId: UUID, row: (child: UUID, parent: UUID, kind: String) -> T): List<T> =
        jdbc.query(
            "SELECT p.child_id, p.parent_id, p.kind FROM member_parents p JOIN members m ON m.id = p.child_id WHERE m.family_id = ?",
            { rs, _ -> row(rs.getObject(1, UUID::class.java), rs.getObject(2, UUID::class.java), rs.getString(3)) },
            familyId,
        )

    private fun newSlug(name: String) = uniqueSlug(name, familyRepository::existsBySlug)

    private fun creator() = CurrentUser.current()?.email?.normalizedEmail()

    // Whoever creates a family becomes its developer.
    private fun saveNew(family: FamilyEntity): FamilyEntity =
        familyRepository.saveAndFlush(family).also { saved ->
            saved.createdBy?.let { memberships.grant(saved.id, it, Role.DEVELOPER, it) }
        }

    private fun FamilyEntity.toSummary(members: List<MemberEntity>, photoUpdatedAt: OffsetDateTime? = null) = FamilySummary().apply {
        id = this@toSummary.id
        name = this@toSummary.name
        slug = this@toSummary.slug
        memberCount = members.size
        childCount = members.count { it.parents.isNotEmpty() }
        generationCount = memberGenerations(members)
        testSettings = this@toSummary.totalUsers?.let {
            TestFamilySettings(
                it,
                this@toSummary.generationCount ?: 1,
                this@toSummary.minChildren ?: 0,
                this@toSummary.maxChildren ?: 3,
            )
        }
        this.photoUpdatedAt = photoUpdatedAt
        photoFit = PhotoFit.fromValue(this@toSummary.photoFit)
    }

    private fun memberGenerations(members: List<MemberEntity>): Int {
        val memberById = members.associateBy { it.id }
        val depth = mutableMapOf<UUID, Int>()
        fun generation(id: UUID, visiting: Set<UUID> = emptySet()): Int {
            depth[id]?.let { return it }
            if (id in visiting) return 0
            val parents = memberById[id]?.parents.orEmpty()
            val result = if (parents.isEmpty()) 0 else parents.maxOf { generation(it.id, visiting + id) + 1 }
            depth[id] = result
            return result
        }
        return members.maxOfOrNull { generation(it.id) + 1 } ?: 0
    }
}

internal const val DEFAULT_FAMILY_NAME = "default"
private const val MAX_IMPORTED_PEOPLE = 2000

sealed interface FamilyCreationResult {
    data class CREATED(val summary: FamilySummary) : FamilyCreationResult
    data object INVALID : FamilyCreationResult
    data object NAME_TAKEN : FamilyCreationResult
}

sealed interface FamilyArchiveResult {
    data class ARCHIVED(val summary: FamilySummary) : FamilyArchiveResult
    data object INVALID : FamilyArchiveResult
    data object NOT_FOUND : FamilyArchiveResult
    data object NAME_TAKEN : FamilyArchiveResult
}

sealed interface FamilyImportResult {
    data class IMPORTED(val summary: FamilySummary) : FamilyImportResult
    data object INVALID : FamilyImportResult
    data object NAME_TAKEN : FamilyImportResult
}

sealed interface FamilyAnonymizeResult {
    data class ANONYMIZED(val summary: FamilySummary) : FamilyAnonymizeResult
    data object NOT_FOUND : FamilyAnonymizeResult
    data object INVALID : FamilyAnonymizeResult
    data object NAME_TAKEN : FamilyAnonymizeResult
}

sealed interface FamilyRenameResult {
    data class RENAMED(val summary: FamilySummary) : FamilyRenameResult
    data object NOT_FOUND : FamilyRenameResult
    data object INVALID : FamilyRenameResult
    data object NAME_TAKEN : FamilyRenameResult
}

data class FamilyExport(val name: String, val gedcom: String)

internal data class PlannedPerson(val generation: Int, val parentIndex: Int? = null)

internal fun planFamily(
    totalUsers: Int,
    generationCount: Int,
    minChildren: Int,
    maxChildren: Int,
): List<PlannedPerson>? {
    if (generationCount == 1) return List(totalUsers) { PlannedPerson(generation = 0) }

    val failed = mutableSetOf<Triple<Int, Int, Int>>()
    fun laterGenerations(generation: Int, remaining: Int, parentCount: Int): List<Int>? {
        val state = Triple(generation, remaining, parentCount)
        if (state in failed) return null

        val minimum = maxOf(1, parentCount * minChildren)
        val maximum = minOf(parentCount * maxChildren, remaining - (generationCount - generation - 1))
        if (minimum > maximum) {
            failed.add(state)
            return null
        }

        if (generation == generationCount - 1) {
            if (remaining in minimum..(parentCount * maxChildren)) return listOf(remaining)
            failed.add(state)
            return null
        }

        val target = (remaining.toDouble() / (generationCount - generation))
            .roundToInt()
            .coerceIn(minimum, maximum)
        for (distance in 0..(maximum - minimum)) {
            val candidates = if (distance == 0) listOf(target) else listOf(target - distance, target + distance)
            for (count in candidates) {
                if (count !in minimum..maximum) continue
                val later = laterGenerations(generation + 1, remaining - count, count)
                if (later != null) return listOf(count) + later
            }
        }

        failed.add(state)
        return null
    }

    val maximumFirstGeneration = totalUsers - (generationCount - 1)
    if (maximumFirstGeneration < 1) return null
    var counts: List<Int>? = null
    for (firstCount in 1..maximumFirstGeneration) {
        val later = laterGenerations(1, totalUsers - firstCount, firstCount)
        if (later != null) {
            counts = listOf(firstCount) + later
            break
        }
    }
    val populationCounts = counts ?: return null
    val plan = mutableListOf<PlannedPerson>()
    val generationIndexes = mutableListOf<List<Int>>()
    populationCounts.forEachIndexed { generation, count ->
        val indexes = (0 until count).map { index ->
            plan.add(PlannedPerson(generation))
            plan.lastIndex
        }
        generationIndexes.add(indexes)
    }

    for (generation in 0 until generationCount - 1) {
        val parents = generationIndexes[generation]
        val children = generationIndexes[generation + 1]
        val childCounts = MutableList(parents.size) { minChildren }
        var remainingChildren = children.size - parents.size * minChildren
        var parent = 0
        while (remainingChildren > 0) {
            if (childCounts[parent] < maxChildren) {
                childCounts[parent]++
                remainingChildren--
            }
            parent = (parent + 1) % parents.size
        }
        var childOffset = 0
        parents.forEachIndexed { parentIndex, _ ->
            repeat(childCounts[parentIndex]) {
                val index = children[childOffset++]
                plan[index] = plan[index].copy(parentIndex = parents[parentIndex])
            }
        }
    }
    return plan
}
