package com.github.bff.member

import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Relatives
import com.github.bff.generated.model.Sibling
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class SiblingsTest {
    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberRepository: MemberRepository

    @Autowired
    private lateinit var memberService: MemberService

    private lateinit var familyId: UUID
    private lateinit var mother: UUID
    private lateinit var father: UUID
    private lateinit var other: UUID
    private lateinit var member: UUID
    private lateinit var sibling: UUID

    @BeforeTest
    fun createFamily() {
        familyId = familyRepository.save(FamilyEntity(name = "Siblings test ${UUID.randomUUID()}")).id
        mother = create("Mother")
        father = create("Father")
        other = create("Other")
        member = create("Member")
        sibling = create("Sibling")
    }

    @Test
    fun `gives full siblings all of the member's parents`() {
        update(member, listOf(mother, father), mapOf(sibling to listOf(mother, father)))

        assertEquals(setOf(mother, father), parentsOf(sibling))
    }

    @Test
    fun `keeps only the shared parent of a half-sibling and their other parents`() {
        update(sibling, listOf(mother, other))
        update(member, listOf(mother, father), mapOf(sibling to listOf(mother)))
        assertEquals(setOf(mother, other), parentsOf(sibling))

        update(sibling, listOf(mother, father))
        update(member, listOf(mother, father), mapOf(sibling to listOf(father)))
        assertEquals(setOf(father), parentsOf(sibling))
    }

    @Test
    fun `removing a sibling removes only the member's parents`() {
        update(sibling, listOf(mother, other))
        update(member, listOf(mother), emptyMap())

        assertEquals(setOf(other), parentsOf(sibling))
    }

    @Test
    fun `rejects siblings without shared parents`() {
        assertEquals(RelativesResult.INVALID, update(member, emptyList(), mapOf(sibling to listOf(mother))))
        assertEquals(RelativesResult.INVALID, update(member, listOf(mother), mapOf(sibling to emptyList())))
        assertEquals(RelativesResult.INVALID, update(member, listOf(mother), mapOf(sibling to listOf(father))))
        assertEquals(RelativesResult.INVALID, update(member, listOf(mother), mapOf(mother to listOf(mother))))
        assertEquals(emptySet(), parentsOf(sibling))
    }

    @Test
    fun `rejects an ancestor as sibling`() {
        update(mother, listOf(other))

        assertEquals(RelativesResult.INVALID, update(member, listOf(mother), mapOf(other to listOf(mother))))
        assertEquals(emptySet(), parentsOf(other))
    }

    @Test
    fun `leaves siblings unchanged when none are sent`() {
        update(sibling, listOf(mother, father))
        update(member, listOf(mother))

        assertEquals(setOf(mother, father), parentsOf(sibling))
    }

    private fun create(firstName: String) = memberService.create(familyId, CreateMemberRequest(firstName, "Test"))!!.id

    private fun update(id: UUID, parentIds: List<UUID>, siblings: Map<UUID, List<UUID>>? = null) =
        memberService.updateRelatives(
            familyId,
            id,
            Relatives(parentIds, emptyList(), emptyList()).siblings(siblings?.map { (siblingId, shared) -> Sibling(siblingId, shared) }),
        )

    private fun parentsOf(id: UUID) = memberRepository.findByIdAndFamilyId(id, familyId)!!.parents.map { it.id }.toSet()
}
