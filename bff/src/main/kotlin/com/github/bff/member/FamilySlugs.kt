package com.github.bff.member

import java.security.SecureRandom

const val MAX_SLUG_LENGTH = 60

// A new family's URL segment: 10 random lowercase letters and digits, so the URL says nothing about the name and
// nobody learns from it that another tree with the same name exists. V26 gave every older family one as well.
// The UI's own routes (`RESERVED_SLUGS` in ui/app/slugRoute.ts) are shorter, so a random slug never hits one.
fun randomSlug(isTaken: (String) -> Boolean = { false }): String =
    generateSequence { (1..SLUG_LENGTH).map { ALPHABET[RANDOM.nextInt(ALPHABET.length)] }.joinToString("") }
        .first { !isTaken(it) }

private const val SLUG_LENGTH = 10
private const val ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
private val RANDOM = SecureRandom()
