package com.github.bff.member

import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class GedcomTest {
    private val sample = listOf(
        "\uFEFF0 HEAD",
        "1 GEDC",
        "2 VERS 5.5.1",
        "0 @I1@ INDI",
        "1 NAME Hans /Müller/",
        "1 BIRT",
        "2 DATE 12 MAR 1950",
        "2 PLAC Köln",
        "1 NOTE Erste Zeile",
        "2 CONT zweite Zei",
        "2 CONC le",
        "0 @I2@ INDI",
        "1 NAME",
        "2 GIVN Erika",
        "2 SURN Muster",
        "1 BIRT",
        "2 DATE ABT 1952",
        "1 DEAT",
        "2 DATE MAR 2020",
        "1 _CUSTOM ignoriert",
        "0 @I3@ INDI",
        "1 NOTE @N1@",
        "0 @N1@ NOTE Notiz aus",
        "1 CONC  Datensatz",
        "0 @F1@ FAM",
        "1 HUSB @I1@",
        "1 WIFE @I2@",
        "1 CHIL @I3@",
        "1 CHIL @I9@",
        "0 TRLR",
    ).joinToString("\r\n")

    @Test
    fun `reads people, partners, children, and continued notes`() {
        val people = assertNotNull(parseGedcom(sample)).associateBy { it.id }

        val hans = people.getValue("@I1@")
        assertEquals("Hans", hans.firstName)
        assertEquals("Müller", hans.lastName)
        assertEquals(LocalDate.of(1950, 3, 12), hans.birthDate)
        assertEquals("Köln", hans.birthPlace)
        assertEquals("Erste Zeile\nzweite Zeile", hans.note)
        assertEquals(setOf("@I2@"), hans.partnerIds)

        val erika = people.getValue("@I2@")
        assertEquals("Erika", erika.firstName)
        assertEquals("Muster", erika.lastName)
        assertEquals(setOf("@I1@"), erika.partnerIds)

        val child = people.getValue("@I3@")
        assertEquals("Unbekannt", child.firstName)
        assertEquals("Unbekannt", child.lastName)
        assertEquals(setOf("@I1@", "@I2@"), child.parentIds)
        assertEquals("Notiz aus Datensatz", child.note)
        assertEquals(3, people.size)
    }

    @Test
    fun `keeps imprecise dates verbatim in the note`() {
        val erika = assertNotNull(parseGedcom(sample)).single { it.id == "@I2@" }

        assertNull(erika.birthDate)
        assertNull(erika.deathDate)
        assertEquals("Geburt laut GEDCOM: ABT 1952\nTod laut GEDCOM: MAR 2020", erika.note)
    }

    @Test
    fun `rejects text that is not gedcom`() {
        assertNull(parseGedcom("""{"name": "keine GEDCOM-Datei"}"""))
        assertNull(parseGedcom("0 @I1@ INDI\n1 NAME Ohne /Kopf/"))
    }

    @Test
    fun `writes what it reads back`() {
        val people = listOf(
            GedcomPerson("a", "Anna", "Alt", LocalDate.of(1900, 1, 2), "Berlin", LocalDate.of(1980, 12, 31), "Bonn", "Zeile 1\nZeile 2 mit @", partnerIds = setOf("b")),
            GedcomPerson("b", "Bernd", "Alt", partnerIds = setOf("a")),
            GedcomPerson("c", "Clara", "Alt", parentIds = setOf("a", "b")),
            // Co-parents who are not partners stay unpaired.
            GedcomPerson("d", "Dora", "Neu"),
            GedcomPerson("e", "Emil", "Neu", parentIds = setOf("c", "d")),
            GedcomPerson("f", "Fritz", "Solo", parentIds = setOf("d")),
        )

        val read = assertNotNull(parseGedcom(writeGedcom(people)))

        val ids = people.withIndex().associate { (i, person) -> "@I${i + 1}@" to person.id }
        assertEquals(people, read.map { person ->
            person.copy(
                id = ids.getValue(person.id),
                parentIds = person.parentIds.map(ids::getValue).toSet(),
                partnerIds = person.partnerIds.map(ids::getValue).toSet(),
            )
        })
    }
}
