package com.github.bff.member

import java.text.Normalizer

const val MAX_SLUG_LENGTH = 60

// Lowercase ASCII words joined by "-", e.g. "Familie Müller" → "familie-mueller"; V17 fills existing families the
// same way. A name without letters or digits becomes "family".
fun slugOf(name: String): String {
    val folded = name.lowercase().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    val ascii = Normalizer.normalize(folded, Normalizer.Form.NFD).replace(MARKS, "")
    return ascii.replace(NON_ALPHANUMERIC, "-").trim('-').take(MAX_SLUG_LENGTH).trimEnd('-').ifEmpty { "family" }
}

// The name's slug, or the first free one with "-2", "-3", … appended.
fun uniqueSlug(name: String, taken: (String) -> Boolean): String {
    val base = slugOf(name)
    if (!taken(base)) return base
    return generateSequence(2) { it + 1 }
        .map { n -> "${base.take(MAX_SLUG_LENGTH - n.toString().length - 1).trimEnd('-')}-$n" }
        .first { !taken(it) }
}

private val MARKS = Regex("""\p{M}+""")
private val NON_ALPHANUMERIC = Regex("[^a-z0-9]+")
