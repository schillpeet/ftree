package com.github.bff.member

import com.github.bff.generated.model.AnonymizeFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Partnership
import com.github.bff.generated.model.Partnership.StatusEnum.MARRIED
import com.github.bff.generated.model.Placement
import com.github.bff.generated.model.Relatives
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class AnonymizeFamilyTest {
    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberService: MemberService

    @Test
    fun `copies the structure under random names without photos`() {
        val source = familyRepository.save(FamilyEntity(name = "Anonymize test ${UUID.randomUUID()}")).id
        fun add(first: String, last: String, birthName: String?, year: Int) =
            memberService.create(source, CreateMemberRequest(first, last).birthName(birthName).birthDate(LocalDate.of(year, 1, 1)))!!.id
        val anna = add("Anna", "Zander", "Quast", 1950)
        val bernd = add("Bernd", "Zander", null, 1951)
        val clara = add("Clara", "Zander", "Zander", 1980)
        add("", "", null, 1990)
        memberService.updateRelatives(
            source, anna,
            Relatives(emptyList(), listOf(clara), listOf(bernd)).partnerships(listOf(Partnership(bernd, MARRIED).marriedOn(LocalDate.of(1975, 5, 5)))),
        )
        memberService.updateRelatives(source, bernd, Relatives(emptyList(), listOf(clara), listOf(anna)))
        memberService.updatePlacement(source, clara, Placement().pinId(3))
        memberService.updatePhoto(source, anna, "image/png", byteArrayOf(1))
        val before = memberService.findAll(source)!!

        val result = familyService.anonymize(source, AnonymizeFamilyRequest("Anonym ${UUID.randomUUID()}"))
        val copy = memberService.findAll((result as FamilyAnonymizeResult.ANONYMIZED).summary.id)!!

        assertEquals(shape(before), shape(copy))
        val originalNames = setOf("Anna", "Bernd", "Clara", "Zander", "Quast")
        assertTrue(copy.flatMap { listOfNotNull(it.firstName, it.lastName, it.birthName) }.none { it in originalNames })
        assertEquals(1, copy.filter { it.lastName.isNotEmpty() }.map { it.lastName }.toSet().size)
        val copiedClara = copy.single { it.birthDate?.year == 1980 }
        assertEquals(copiedClara.lastName, copiedClara.birthName)
        val unknown = copy.single { it.birthDate?.year == 1990 }
        assertEquals("" to "", unknown.firstName to unknown.lastName)
        assertTrue(copy.all { it.photoUpdatedAt == null })
        assertEquals(before, memberService.findAll(source))
    }

    @Test
    fun `refuses missing families, invalid and taken names`() {
        val source = familyRepository.save(FamilyEntity(name = "Anonymize test ${UUID.randomUUID()}"))
        assertEquals(FamilyAnonymizeResult.NOT_FOUND, familyService.anonymize(UUID.randomUUID(), AnonymizeFamilyRequest("x")))
        assertEquals(FamilyAnonymizeResult.INVALID, familyService.anonymize(source.id, AnonymizeFamilyRequest(" ")))
        assertEquals(FamilyAnonymizeResult.NAME_TAKEN, familyService.anonymize(source.id, AnonymizeFamilyRequest(source.name.uppercase())))
        assertNull(familyRepository.findByNameIgnoreCase(" "))
    }

    // Everything but ids, names, and photos, with links expressed by birth year.
    private fun shape(members: List<Member>): Set<List<Any?>> {
        val year = members.associate { it.id to it.birthDate?.year }
        return members.map { member ->
            listOf(
                member.birthDate, member.pinId, member.position,
                member.parentIds.map(year::getValue).toSet(),
                member.partnerships.map { Triple(year.getValue(it.partnerId), it.status, it.marriedOn) }.toSet(),
            )
        }.toSet()
    }
}
