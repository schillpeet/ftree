package com.github.bff.member

import java.time.DateTimeException
import java.time.LocalDate

/** A person as read from or written to GEDCOM; ids are GEDCOM xrefs on import and member ids on export. */
internal data class GedcomPerson(
    val id: String,
    val firstName: String,
    val lastName: String,
    val birthDate: LocalDate? = null,
    val birthPlace: String? = null,
    val deathDate: LocalDate? = null,
    val deathPlace: String? = null,
    val note: String? = null,
    val parentIds: Set<String> = emptySet(),
    val partnerIds: Set<String> = emptySet(),
)

private class GedcomLine(val level: Int, val xref: String?, val tag: String, val value: String) {
    val children = mutableListOf<GedcomLine>()

    fun child(tag: String) = children.firstOrNull { it.tag == tag }

    fun all(tag: String) = children.filter { it.tag == tag }

    /** The value with its CONT (new line) and CONC (same line) continuations. */
    fun text() = buildString {
        append(value)
        children.forEach {
            when (it.tag) {
                "CONT" -> append('\n').append(it.value)
                "CONC" -> append(it.value)
            }
        }
    }.replace("@@", "@")
}

private val LINE = Regex("""^\s*(\d+)\s+(?:(@[^@\s]+@)\s+)?(\S+)(?: (.*))?$""")
private val EXACT_DATE = Regex("""^(\d{1,2}) ([A-Z]{3}) (\d{1,4})$""")
private val MONTHS = listOf("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
private const val UNKNOWN_NAME = "Unbekannt"

/**
 * Reads people, partners (HUSB/WIFE of a FAM) and parents (its CHIL) from a GEDCOM 5.5.1 or 7 file.
 * Unknown tags and references to missing records are ignored. Null when the text is not GEDCOM.
 */
internal fun parseGedcom(text: String): List<GedcomPerson>? {
    val records = mutableListOf<GedcomLine>()
    val open = ArrayDeque<GedcomLine>()
    for (raw in text.removePrefix("\uFEFF").lines()) {
        if (raw.isBlank()) continue
        val (level, xref, tag, value) = LINE.matchEntire(raw)?.destructured ?: return null
        val line = GedcomLine(level.toInt(), xref.ifEmpty { null }, tag.uppercase(), value)
        while (open.isNotEmpty() && open.last().level >= line.level) open.removeLast()
        when {
            line.level == 0 -> records.add(line)
            open.isEmpty() -> continue
            else -> open.last().children.add(line)
        }
        open.addLast(line)
    }
    if (records.firstOrNull()?.tag != "HEAD") return null

    val byXref = records.filter { it.xref != null }.associateBy { it.xref }
    val individuals = records.filter { it.tag == "INDI" && it.xref != null }.associateBy { it.xref!! }
    val parents = individuals.keys.associateWith { mutableSetOf<String>() }
    val partners = individuals.keys.associateWith { mutableSetOf<String>() }
    records.filter { it.tag == "FAM" }.forEach { family ->
        val spouses = family.children.filter { it.tag == "HUSB" || it.tag == "WIFE" }
            .map { it.value.trim() }.filter { it in individuals }.toSet()
        spouses.forEach { spouse -> partners.getValue(spouse).addAll(spouses - spouse) }
        family.all("CHIL").map { it.value.trim() }.filter { it in individuals }.forEach { child ->
            parents.getValue(child).addAll(spouses - child)
        }
    }

    return individuals.map { (xref, person) ->
        val name = person.child("NAME")
        val parts = name?.value?.split('/').orEmpty()
        val given = parts.getOrNull(0)?.trim().orEmpty().ifEmpty { name?.child("GIVN")?.value?.trim().orEmpty() }
        val surname = parts.getOrNull(1)?.trim().orEmpty().ifEmpty { name?.child("SURN")?.value?.trim().orEmpty() }
        val birth = person.child("BIRT")
        val death = person.child("DEAT")
        val birthDate = birth?.child("DATE")?.value?.trim()
        val deathDate = death?.child("DATE")?.value?.trim()
        val notes = person.children.filter { it.tag == "NOTE" || it.tag == "SNOTE" }.map { note -> byXref[note.value.trim()]?.text() ?: note.text() }
        // Imprecise dates are kept verbatim in the note instead of inventing a day.
        val dateNotes = listOfNotNull(
            birthDate?.takeIf { it.isNotEmpty() && exactDate(it) == null }?.let { "Geburt laut GEDCOM: $it" },
            deathDate?.takeIf { it.isNotEmpty() && exactDate(it) == null }?.let { "Tod laut GEDCOM: $it" },
        )
        GedcomPerson(
            id = xref,
            firstName = given.ifEmpty { UNKNOWN_NAME }.take(100),
            lastName = surname.ifEmpty { UNKNOWN_NAME }.take(100),
            birthDate = birthDate?.let(::exactDate),
            birthPlace = birth?.child("PLAC")?.text()?.trim()?.ifEmpty { null }?.take(200),
            deathDate = deathDate?.let(::exactDate),
            deathPlace = death?.child("PLAC")?.text()?.trim()?.ifEmpty { null }?.take(200),
            note = (notes + dateNotes).filter { it.isNotBlank() }.joinToString("\n").ifEmpty { null }?.take(5000),
            parentIds = parents.getValue(xref),
            partnerIds = partners.getValue(xref),
        )
    }
}

private fun exactDate(value: String): LocalDate? {
    val (day, month, year) = EXACT_DATE.matchEntire(value.uppercase())?.destructured ?: return null
    val monthNumber = MONTHS.indexOf(month) + 1
    if (monthNumber == 0) return null
    return try {
        LocalDate.of(year.toInt(), monthNumber, day.toInt())
    } catch (_: DateTimeException) {
        null
    }
}

/**
 * Writes a GEDCOM 5.5.1 file: one INDI per person and one FAM per partner pair or single parent with
 * their children. Co-parents who are not partners get a FAM each, so a re-import does not pair them.
 */
// ponytail: long lines are not split with CONC at 255 characters; add it when a strict reader rejects long notes.
internal fun writeGedcom(people: List<GedcomPerson>): String {
    val index = people.withIndex().associate { (i, person) -> person.id to i }
    val families = linkedMapOf<List<String>, MutableList<String>>()
    fun family(spouses: Collection<String>) = families.getOrPut(spouses.sortedBy(index::getValue)) { mutableListOf() }
    people.forEach { person ->
        person.partnerIds.filter { it in index && it != person.id }.forEach { family(setOf(person.id, it)) }
    }
    people.forEach { child ->
        val parents = child.parentIds.filter { it in index && it != child.id }
        val couple = parents.size == 2 && people[index.getValue(parents[0])].partnerIds.contains(parents[1])
        if (parents.size == 1 || couple) {
            family(parents).add(child.id)
        } else {
            parents.forEach { family(listOf(it)).add(child.id) }
        }
    }
    val familyXrefs = families.keys.withIndex().associate { (i, spouses) -> spouses to "@F${i + 1}@" }
    fun xref(id: String) = "@I${index.getValue(id) + 1}@"

    val lines = mutableListOf(
        "0 HEAD", "1 SOUR FTREE", "1 SUBM @U1@", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8",
        "0 @U1@ SUBM", "1 NAME ftree",
    )
    fun text(level: Int, tag: String, value: String) {
        val textLines = value.replace("@", "@@").lines()
        textLines.forEachIndexed { i, line ->
            val prefix = if (i == 0) "$level $tag" else "${level + 1} CONT"
            lines += if (line.isEmpty()) prefix else "$prefix $line"
        }
    }
    fun event(tag: String, date: LocalDate?, place: String?) {
        if (date == null && place == null) return
        lines += "1 $tag"
        date?.let { lines += "2 DATE ${it.dayOfMonth} ${MONTHS[it.monthValue - 1]} ${it.year}" }
        place?.let { text(2, "PLAC", it) }
    }
    people.forEach { person ->
        lines += "0 ${xref(person.id)} INDI"
        lines += "1 NAME ${person.firstName} /${person.lastName}/"
        event("BIRT", person.birthDate, person.birthPlace)
        event("DEAT", person.deathDate, person.deathPlace)
        person.note?.let { text(1, "NOTE", it) }
        families.forEach { (spouses, children) ->
            if (person.id in children) lines += "1 FAMC ${familyXrefs[spouses]}"
            if (person.id in spouses) lines += "1 FAMS ${familyXrefs[spouses]}"
        }
    }
    families.forEach { (spouses, children) ->
        lines += "0 ${familyXrefs[spouses]} FAM"
        spouses.getOrNull(0)?.let { lines += "1 HUSB ${xref(it)}" }
        spouses.getOrNull(1)?.let { lines += "1 WIFE ${xref(it)}" }
        children.forEach { lines += "1 CHIL ${xref(it)}" }
    }
    lines += "0 TRLR"
    return lines.joinToString("\r\n", postfix = "\r\n")
}
