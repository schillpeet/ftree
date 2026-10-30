package com.github.bff.member

import com.github.bff.generated.model.ParentLink.KindEnum
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
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
    val birthName: String? = null,
    /** Kind of the link to each parent in [parentIds]; a parent missing here is biological. */
    val parentKinds: Map<String, KindEnum> = emptyMap(),
)

private class GedcomLine(val level: Int, val xref: String?, val tag: String, val value: String) {
    val children = mutableListOf<GedcomLine>()

    fun child(tag: String) = children.firstOrNull { it.tag == tag }

    fun all(tag: String) = children.filter { it.tag == tag }

    /** The value with its CONT (new line) and CONC (same line) continuations, cut after about [limit] characters. */
    fun text(limit: Int = Int.MAX_VALUE) = buildString {
        append(value, 0, minOf(value.length, limit))
        for (it in children) {
            if (length >= limit) break
            when (it.tag) {
                "CONT" -> append('\n').append(it.value)
                "CONC" -> append(it.value)
            }
        }
    }.take(limit).replace("@@", "@")
}

private val LINE = Regex("""^\s*(\d+)\s+(?:(@[^@\s]+@)\s+)?(\S+)(?: (.*))?$""")
private val EXACT_DATE = Regex("""^(\d{1,2}) ([A-Z]{3}) (\d{1,4})$""")
private val MONTHS = listOf("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
private val BIRTH_NAME_TYPES = setOf("birth", "maiden")
private const val MAX_NOTE_LENGTH = 5000
// Every kept line costs about 150 bytes of heap; real files have a few dozen lines per person.
private const val MAX_LINES = 200_000

private fun GedcomLine.nameType() = child("TYPE")?.value?.trim()?.lowercase()

/** Given name and surname of a NAME line, from "Given /Surname/" or its GIVN/SURN parts. */
private fun GedcomLine?.nameParts(): Pair<String, String> {
    val parts = this?.value?.split('/').orEmpty()
    val given = parts.getOrNull(0)?.trim().orEmpty().ifEmpty { this?.child("GIVN")?.value?.trim().orEmpty() }
    val surname = parts.getOrNull(1)?.trim().orEmpty().ifEmpty { this?.child("SURN")?.value?.trim().orEmpty() }
    return given to surname
}

/**
 * Reads people, partners (HUSB/WIFE of a FAM) and parents (its CHIL) from a GEDCOM 5.5.1 or 7 file.
 * Unknown tags and references to missing records are ignored. Null when the text is not GEDCOM or has more than
 * [MAX_LINES] lines; more than [maxPeople] people answer MEMBER_LIMIT_REACHED before any person is built.
 */
internal fun parseGedcom(text: String, maxPeople: Int = Int.MAX_VALUE): List<GedcomPerson>? {
    val records = mutableListOf<GedcomLine>()
    val open = ArrayDeque<GedcomLine>()
    var lineCount = 0
    for (raw in text.removePrefix("\uFEFF").lineSequence()) {
        if (raw.isBlank()) continue
        if (++lineCount > MAX_LINES) return null
        val (level, xref, tag, value) = LINE.matchEntire(raw)?.destructured ?: return null
        val line = GedcomLine(level.toIntOrNull() ?: return null, xref.ifEmpty { null }, tag.uppercase(), value)
        while (open.isNotEmpty() && open.last().level >= line.level) open.removeLast()
        when {
            line.level == 0 -> records.add(line)
            open.isEmpty() -> continue
            else -> open.last().children.add(line)
        }
        open.addLast(line)
    }
    if (records.firstOrNull()?.tag != "HEAD") return null
    if (records.count { it.tag == "INDI" && it.xref != null } > maxPeople) throw ApiProblem(ProblemCode.MEMBER_LIMIT_REACHED)

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

    // PEDI sits under the child's FAMC line and describes the link to that FAM's spouses.
    val parentKinds = individuals.mapValues { (_, person) ->
        val kinds = mutableMapOf<String, KindEnum>()
        person.all("FAMC").forEach { famc ->
            val kind = pedigreeKind(famc.child("PEDI")?.value) ?: return@forEach
            val family = byXref[famc.value.trim()]?.takeIf { it.tag == "FAM" } ?: return@forEach
            family.children.filter { it.tag == "HUSB" || it.tag == "WIFE" }.map { it.value.trim() }
                .filter { it in parents.getValue(person.xref!!) }.forEach { kinds[it] = kind }
        }
        kinds.toMap()
    }

    // A shared NOTE record is read once, however many people refer to it how often.
    val sharedNotes = mutableMapOf<String, String>()
    return individuals.map { (xref, person) ->
        // The current name is a NAME of TYPE married, else the first one not marked as birth name. The birth name
        // comes from a NAME of TYPE birth/maiden, or is the surname a _MARNM or a married NAME replaces.
        val names = person.all("NAME")
        val birthLine = names.firstOrNull { it.nameType() in BIRTH_NAME_TYPES }
        val married = names.firstOrNull { it.nameType() == "married" }
        val current = married ?: names.firstOrNull { it !== birthLine } ?: birthLine
        val (given, currentSurname) = current.nameParts()
        val marriedName = current?.child("_MARNM")?.value?.trim().orEmpty()
        val surname = marriedName.ifEmpty { currentSurname }
        val birthName = when {
            birthLine != null && birthLine !== current -> birthLine.nameParts().second
            marriedName.isNotEmpty() -> currentSurname
            married != null -> names.firstOrNull { it !== married }?.nameParts()?.second
            else -> null
        }?.ifEmpty { null }?.takeIf { it != surname }?.take(100)
        val birth = person.child("BIRT")
        val death = person.child("DEAT")
        val birthDate = birth?.child("DATE")?.value?.trim()
        val deathDate = death?.child("DATE")?.value?.trim()
        val notes = person.children.asSequence().filter { it.tag == "NOTE" || it.tag == "SNOTE" }.map { note ->
            val shared = note.value.trim()
            byXref[shared]?.let { sharedNotes.getOrPut(shared) { it.text(MAX_NOTE_LENGTH) } } ?: note.text(MAX_NOTE_LENGTH)
        }
        // Imprecise dates are kept verbatim in the note instead of inventing a day.
        val dateNotes = listOfNotNull(
            birthDate?.takeIf { it.isNotEmpty() && exactDate(it) == null }?.let { "Geburt laut GEDCOM: $it" },
            deathDate?.takeIf { it.isNotEmpty() && exactDate(it) == null }?.let { "Tod laut GEDCOM: $it" },
        )
        GedcomPerson(
            id = xref,
            firstName = given.take(100),
            lastName = surname.take(100),
            birthDate = birthDate?.let(::exactDate),
            birthPlace = birth?.child("PLAC")?.text()?.trim()?.ifEmpty { null }?.take(200),
            deathDate = deathDate?.let(::exactDate),
            deathPlace = death?.child("PLAC")?.text()?.trim()?.ifEmpty { null }?.take(200),
            note = buildString {
                // Stops at the length limit, so many references to one note do not pile up.
                for (part in (notes + dateNotes).filter { it.isNotBlank() }) {
                    if (length >= MAX_NOTE_LENGTH) break
                    if (isNotEmpty()) append('\n')
                    append(part)
                }
            }.ifEmpty { null }?.take(MAX_NOTE_LENGTH),
            parentIds = parents.getValue(xref),
            partnerIds = partners.getValue(xref),
            birthName = birthName,
            parentKinds = parentKinds.getValue(xref),
        )
    }
}

/** The PEDI value written for a link kind; null for biological and step links, which are written without PEDI. */
private fun pedigreeValue(kind: KindEnum?): String? = when (kind) {
    KindEnum.ADOPTIVE -> "adopted"
    KindEnum.FOSTER -> "foster"
    else -> null
}

/** The non-biological kind of a PEDI value (any casing); null for birth, unknown, or missing values. */
private fun pedigreeKind(value: String?) = when (value?.trim()?.lowercase()) {
    "adopted" -> KindEnum.ADOPTIVE
    "foster" -> KindEnum.FOSTER
    else -> null
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
        // A couple shares a FAM only when the PEDI written for the child's links to both is the same (PEDI is per FAMC).
        val couple = parents.size == 2 && people[index.getValue(parents[0])].partnerIds.contains(parents[1]) &&
            pedigreeValue(child.parentKinds[parents[0]]) == pedigreeValue(child.parentKinds[parents[1]])
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
        // Unknown (empty) names stay empty: "/Surname/" or "//".
        lines += "1 NAME ${"${person.firstName} /${person.lastName}/".trim()}"
        person.birthName?.takeIf { it != person.lastName }?.let {
            lines += "1 NAME ${"${person.firstName} /$it/".trim()}"
            lines += "2 TYPE birth"
        }
        event("BIRT", person.birthDate, person.birthPlace)
        event("DEAT", person.deathDate, person.deathPlace)
        person.note?.let { text(1, "NOTE", it) }
        families.forEach { (spouses, children) ->
            if (person.id in children) {
                lines += "1 FAMC ${familyXrefs[spouses]}"
                // Biological and step links are written without PEDI; step has no 5.5.1 value.
                pedigreeValue(spouses.firstOrNull { it in person.parentIds }?.let(person.parentKinds::get))
                    ?.let { lines += "2 PEDI $it" }
            }
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
