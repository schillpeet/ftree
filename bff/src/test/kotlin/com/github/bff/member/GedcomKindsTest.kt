package com.github.bff.member

import com.github.bff.generated.model.ImportFamilyRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.ParentLink.KindEnum
import com.github.bff.generated.model.ParentLink.KindEnum.ADOPTIVE
import com.github.bff.generated.model.ParentLink.KindEnum.BIOLOGICAL
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class GedcomKindsTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberService: MemberService

    // Adoptiv: adopted by a couple. Gemischt: Mutter and Vater are partners (childless FAM F0), but the mother's
    // link (own FAM, no PEDI) is biological and the father's (own FAM, adopted) adoptive.
    private val gedcom = listOf(
        "0 HEAD",
        "0 @I1@ INDI", "1 NAME Hans /Test/",
        "0 @I2@ INDI", "1 NAME Erika /Test/",
        "0 @I3@ INDI", "1 NAME Adoptiv /Test/", "1 FAMC @F1@", "2 PEDI adopted",
        "0 @I4@ INDI", "1 NAME Mutter /Zwei/",
        "0 @I5@ INDI", "1 NAME Vater /Zwei/",
        "0 @I6@ INDI", "1 NAME Gemischt /Zwei/", "1 FAMC @F2@", "1 FAMC @F3@", "2 PEDI adopted",
        "0 @F0@ FAM", "1 HUSB @I5@", "1 WIFE @I4@",
        "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@",
        "0 @F2@ FAM", "1 WIFE @I4@", "1 CHIL @I6@",
        "0 @F3@ FAM", "1 HUSB @I5@", "1 CHIL @I6@",
        "0 TRLR",
    ).joinToString("\n")

    private fun kinds(members: List<Member>, child: String): Map<String, KindEnum> {
        val names = members.associate { it.id to it.firstName }
        return members.single { it.firstName == child }.parentLinks.associate { names.getValue(it.parentId) to it.kind }
    }

    @Test
    fun `keeps parent kinds through import and export`() {
        val imported = familyService.import(ImportFamilyRequest().name("Kinds ${UUID.randomUUID()}").gedcom(gedcom))
        val familyId = (imported as FamilyImportResult.IMPORTED).summary.id

        val members = memberService.findAll(familyId)!!
        assertEquals(mapOf("Hans" to ADOPTIVE, "Erika" to ADOPTIVE), kinds(members, "Adoptiv"))
        assertEquals(mapOf("Mutter" to BIOLOGICAL, "Vater" to ADOPTIVE), kinds(members, "Gemischt"))
        val partnerNames = members.associate { it.id to it.firstName }
        assertEquals(setOf("Vater"), members.single { it.firstName == "Mutter" }.partnerIds.map(partnerNames::getValue).toSet())

        val exported = assertNotNull(familyService.export(familyId)).gedcom
        val lines = exported.lines()
        // Adoptiv has one FAMC; Gemischt has two (one per parent), as the partners' kinds differ.
        assertEquals(3, lines.count { it.startsWith("1 FAMC") })
        val pedi = lines.indices.filter { lines[it] == "2 PEDI adopted" }
        assertEquals(2, pedi.size)
        pedi.forEach { assertTrue(lines[it - 1].startsWith("1 FAMC"), "PEDI must follow a FAMC line") }
        // Gemischt is in no FAM that has both a HUSB and a WIFE.
        val gemischt = lines[lines.indexOf("1 NAME Gemischt /Zwei/") - 1].removeSuffix(" INDI").removePrefix("0 ")
        val coupleFamilies = exported.split("\r\n0 ").filter { it.lineSequence().first().endsWith(" FAM") }
            .filter { it.contains("\r\n1 HUSB ") && it.contains("\r\n1 WIFE ") }
        assertEquals(2, coupleFamilies.size)
        assertTrue(coupleFamilies.none { it.contains("1 CHIL $gemischt") })

        val read = assertNotNull(parseGedcom(exported))
        val nameOf = read.associate { it.id to it.firstName }
        fun parsedKinds(child: String) = read.single { it.firstName == child }.parentKinds.mapKeys { nameOf.getValue(it.key) }
        assertEquals(mapOf("Hans" to ADOPTIVE, "Erika" to ADOPTIVE), parsedKinds("Adoptiv"))
        assertEquals(mapOf("Vater" to ADOPTIVE), parsedKinds("Gemischt"))
        assertEquals(setOf("Mutter", "Vater"), read.single { it.firstName == "Gemischt" }.parentIds.map(nameOf::getValue).toSet())
    }
}
