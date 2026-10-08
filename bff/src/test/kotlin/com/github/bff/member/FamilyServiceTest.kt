package com.github.bff.member

import com.github.bff.generated.model.ArchiveFamilyRequest
import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.ImportFamilyRequest
import com.github.bff.generated.model.Relatives
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
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

    @Test
    fun `archives the default family into a new family and leaves it empty`() {
        val default = familyRepository.findByNameIgnoreCase(DEFAULT_FAMILY_NAME)
        assertNotNull(default)
        val parent = memberService.createDefaultFamilyMember(CreateMemberRequest("Parent", "Archive"))
        val child = memberService.createDefaultFamilyMember(CreateMemberRequest("Child", "Archive"))
        assertNotNull(parent)
        assertNotNull(child)
        memberService.updateDefaultFamilyMemberRelatives(child.id, Relatives(listOf(parent.id), emptyList(), emptyList()))
        val before = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(default.id).size
        val name = "Archiv ${UUID.randomUUID()}"

        val result = familyService.archive(default.id, ArchiveFamilyRequest(name))

        assertTrue(result is FamilyArchiveResult.ARCHIVED)
        assertEquals(name, result.summary.name)
        assertEquals(before, result.summary.memberCount)
        assertNull(result.summary.testSettings)
        assertTrue(familyRepository.existsById(default.id))
        assertTrue(memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(default.id).isEmpty())
        val moved = memberRepository.findByIdAndFamilyId(child.id, result.summary.id)
        assertNotNull(moved)
        assertEquals(listOf(parent.id), moved.parents.map { it.id })
    }

    @Test
    fun `refuses to archive under a taken name, an empty family, or an unknown family`() {
        val family = (familyService.create(request()) as FamilyCreationResult.CREATED).summary

        assertEquals(FamilyArchiveResult.NAME_TAKEN, familyService.archive(family.id, ArchiveFamilyRequest(family.name)))
        assertEquals(FamilyArchiveResult.INVALID, familyService.archive(family.id, ArchiveFamilyRequest(" ")))
        assertEquals(FamilyArchiveResult.NOT_FOUND, familyService.archive(UUID.randomUUID(), ArchiveFamilyRequest("Neu")))
        val archived = familyService.archive(family.id, ArchiveFamilyRequest("Archiv ${UUID.randomUUID()}"))
        assertTrue(archived is FamilyArchiveResult.ARCHIVED)
        assertEquals(FamilyArchiveResult.INVALID, familyService.archive(family.id, ArchiveFamilyRequest("Archiv ${UUID.randomUUID()}")))
    }

    @Test
    fun `imports a gedcom file as a new family with its links`() {
        val name = "Import ${UUID.randomUUID()}"
        val gedcom = """
            0 HEAD
            0 @I1@ INDI
            1 NAME Hans /Import/
            0 @I2@ INDI
            1 NAME Erika /Import/
            0 @I3@ INDI
            1 NAME Kind /Import/
            1 BIRT
            2 DATE 1 JAN 2000
            0 @F1@ FAM
            1 HUSB @I1@
            1 WIFE @I2@
            1 CHIL @I3@
            0 TRLR
        """.trimIndent()

        val result = familyService.import(ImportFamilyRequest(name, gedcom))

        assertTrue(result is FamilyImportResult.IMPORTED)
        assertEquals(name, result.summary.name)
        assertEquals(3, result.summary.memberCount)
        assertEquals(1, result.summary.childCount)
        assertEquals(2, result.summary.generationCount)
        val members = memberRepository.findAllByFamilyIdOrderByLastNameAscFirstNameAsc(result.summary.id).associateBy { it.firstName }
        val child = members.getValue("Kind")
        assertEquals(setOf("Hans", "Erika"), child.parents.map { it.firstName }.toSet())
        assertEquals(listOf("Erika"), members.getValue("Hans").partners.map { it.firstName })
        assertEquals(listOf("Hans"), members.getValue("Erika").partners.map { it.firstName })
        assertNull(child.pinId)
        val export = familyService.export(result.summary.id)
        assertNotNull(export)
        assertEquals(name, export.name)
        assertTrue("1 NAME Kind /Import/" in export.gedcom)
    }

    @Test
    fun `refuses to import a parent cycle, unreadable text, or a taken name`() {
        val cycle = """
            0 HEAD
            0 @I1@ INDI
            0 @I2@ INDI
            0 @F1@ FAM
            1 HUSB @I1@
            1 CHIL @I2@
            0 @F2@ FAM
            1 HUSB @I2@
            1 CHIL @I1@
            0 TRLR
        """.trimIndent()
        val family = (familyService.create(request()) as FamilyCreationResult.CREATED).summary

        assertEquals(FamilyImportResult.INVALID, familyService.import(ImportFamilyRequest("Zyklus ${UUID.randomUUID()}", cycle)))
        assertEquals(FamilyImportResult.INVALID, familyService.import(ImportFamilyRequest("Text ${UUID.randomUUID()}", "kein GEDCOM")))
        assertEquals(FamilyImportResult.NAME_TAKEN, familyService.import(ImportFamilyRequest(family.name, "0 HEAD\n0 @I1@ INDI")))
        assertNull(familyService.export(UUID.randomUUID()))
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
