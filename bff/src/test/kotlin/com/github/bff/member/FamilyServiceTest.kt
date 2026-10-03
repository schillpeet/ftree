package com.github.bff.member

import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Relatives
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class FamilyServiceTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberRepository: MemberRepository

    @Autowired
    private lateinit var memberService: MemberService

    @Test
    fun `migration creates an initial family and assigns every existing member`() {
        val families = familyRepository.findAllByOrderByCreatedAtAsc()
        assertTrue(families.any { it.name.equals(DEFAULT_FAMILY_NAME, ignoreCase = true) })
        assertTrue(memberRepository.findAll().all { member -> families.any { it.id == member.family.id } })
        assertEquals(DEFAULT_FAMILY_NAME, familyService.findAll().first().name)
    }

    @Test
    fun `deletes the default family and all of its members`() {
        val family = familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)
        assertNotNull(family)
        assertNotNull(memberService.createDefaultFamilyMember(CreateMemberRequest("Test", "Member")))
        assertTrue(memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(family.id).isNotEmpty())

        assertTrue(familyService.delete(family.id))

        assertFalse(familyRepository.existsById(family.id))
        assertTrue(memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(family.id).isEmpty())
    }

    @Test
    fun `legacy member operations create and list people in the default family`() {
        val created = memberService.createDefaultFamilyMember(
            CreateMemberRequest("Anna", "Default"),
        )

        assertNotNull(created)
        assertTrue(memberService.findDefaultFamilyMembers().any { it.id == created.id })
        val defaultFamily = familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)
        assertNotNull(defaultFamily)
        assertEquals(defaultFamily.id, memberRepository.findByIdAndFamilyId(created.id, defaultFamily.id)?.family?.id)
    }

    @Test
    fun `creates family members links and saved settings together`() {
        val result = familyService.create(request())
        assertTrue(result is FamilyCreationResult.CREATED)
        val family = result.summary

        assertEquals(12, family.memberCount)
        assertEquals(11, family.childCount)
        assertEquals(3, family.generationCount)
        assertEquals(12, family.testSettings?.totalUsers)
        assertEquals(3, family.testSettings?.generationCount)
        assertEquals(0, family.testSettings?.minChildren)
        assertEquals(3, family.testSettings?.maxChildren)

        val members = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(family.id)
        assertEquals(12, members.size)
        assertEquals(3, members.count { it.generationFromParents() == 1 })
        assertEquals(8, members.count { it.generationFromParents() == 2 })
    }

    @Test
    fun `creates four members in two generations with zero to two children`() {
        val result = familyService.create(
            CreateFamilyRequest("Family test ${UUID.randomUUID()}", 4, 2, 0, 2),
        )
        assertTrue(result is FamilyCreationResult.CREATED)
        val family = result.summary
        assertEquals(4, family.memberCount)
        assertEquals(2, family.generationCount)
        assertEquals(4, memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(family.id).size)
    }

    @Test
    fun `keeps member relationships inside their family and deletes all family data`() {
        val first = (familyService.create(request()) as FamilyCreationResult.CREATED).summary
        val second = (familyService.create(request()) as FamilyCreationResult.CREATED).summary
        val foreignMember = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(second.id).first()
        val emptyRelatives = Relatives(emptyList(), emptyList(), emptyList())

        assertEquals(RelativesResult.NOT_FOUND, memberService.updateRelatives(first.id, foreignMember.id, emptyRelatives))

        assertTrue(familyService.delete(second.id))
        assertFalse(familyRepository.existsById(second.id))
        assertTrue(memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(second.id).isEmpty())
        assertNotNull(familyRepository.findById(first.id).orElse(null))
        assertEquals(12, memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(first.id).size)
    }

    private fun request() = CreateFamilyRequest(
        "Family test ${UUID.randomUUID()}",
        12,
        3,
        0,
        3,
    )

    private fun MemberEntity.generationFromParents(): Int =
        if (parents.isEmpty()) 0 else parents.maxOf { it.generationFromParents() + 1 }
}
