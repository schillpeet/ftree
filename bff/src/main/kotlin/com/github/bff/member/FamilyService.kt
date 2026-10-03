package com.github.bff.member

import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.FamilySummary
import com.github.bff.generated.model.TestFamilySettings
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.math.roundToInt

@Service
@Transactional(readOnly = true)
class FamilyService(
    private val familyRepository: FamilyRepository,
    private val memberRepository: MemberRepository,
) {
    fun findAll(): List<FamilySummary> =
        familyRepository.findAllByOrderByCreatedAtAsc().map { family ->
            family.toSummary(memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(family.id))
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

        val family = familyRepository.saveAndFlush(
            FamilyEntity(
                name = name,
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

    @Transactional
    fun delete(id: UUID): Boolean {
        val family = familyRepository.findById(id).orElse(null) ?: return false
        if (family.name.equals(DEFAULT_FAMILY_NAME, ignoreCase = true)) return false
        val members = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(id)
        members.forEach { member ->
            member.parents.clear()
            member.partners.clear()
        }
        memberRepository.flush()
        memberRepository.deleteAll(members)
        familyRepository.delete(family)
        return true
    }

    private fun FamilyEntity.toSummary(members: List<MemberEntity>) = FamilySummary().apply {
        id = this@toSummary.id
        name = this@toSummary.name
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

sealed interface FamilyCreationResult {
    data class CREATED(val summary: FamilySummary) : FamilyCreationResult
    data object INVALID : FamilyCreationResult
    data object NAME_TAKEN : FamilyCreationResult
}

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
