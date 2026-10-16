package com.github.bff.member

import kotlin.random.Random

/**
 * Replaces names with random ones from fixed lists: each original last name maps to the same random
 * last name, birth names reuse that map, and empty names stay empty. No original name is ever picked.
 */
internal class AnonymousNames(originals: List<MemberEntity>, private val random: Random = Random.Default) {
    private val taken = originals.flatMap { listOfNotNull(it.firstName, it.lastName, it.birthName) }
        .map { it.trim().lowercase() }.toSet()
    private val lastNames = mutableMapOf<String, String>()
    // ponytail: cycles through the list once it is used up, so very large families repeat last names.
    private val lastNamePool = LAST_NAMES.filter { it.lowercase() !in taken }.shuffled(random).ifEmpty { listOf("Anonym") }
    private val firstNamePool = FIRST_NAMES.filter { it.lowercase() !in taken }.ifEmpty { listOf("Person") }

    fun firstName(original: String) = if (original.isBlank()) original else firstNamePool.random(random)

    fun lastName(original: String) =
        if (original.isBlank()) original
        else lastNames.getOrPut(original.trim().lowercase()) { lastNamePool[lastNames.size % lastNamePool.size] }

    fun birthName(original: String?) = original?.let(::lastName)
}

private val LAST_NAMES = listOf(
    "Albrecht", "Arnold", "Bauer", "Baumann", "Beck", "Berger", "Brandt", "Busch", "Dietrich", "Engel",
    "Fischer", "Frank", "Friedrich", "Fuchs", "Graf", "Günther", "Haas", "Hahn", "Hartmann", "Heinrich",
    "Herrmann", "Horn", "Jäger", "Kaiser", "Keller", "Klein", "Koch", "Kraus", "Krüger", "Kuhn",
    "Lang", "Lehmann", "Lorenz", "Ludwig", "Maier", "Martin", "Möller", "Neumann", "Otto", "Peters",
    "Pohl", "Roth", "Sauer", "Schäfer", "Schmitt", "Schubert", "Schulze", "Schwarz", "Seidel", "Simon",
    "Sommer", "Stein", "Vogel", "Vogt", "Walter", "Weber", "Werner", "Winkler", "Wolf", "Ziegler",
)

private val FIRST_NAMES = listOf(
    "Anna", "Alexander", "Berta", "Benedikt", "Clara", "Christoph", "Dora", "David", "Emma", "Elias",
    "Frieda", "Felix", "Greta", "Georg", "Hanna", "Hugo", "Ida", "Jakob", "Johanna", "Jonas",
    "Karla", "Konrad", "Lena", "Leon", "Marie", "Max", "Nora", "Noah", "Olga", "Oskar",
    "Paula", "Paul", "Rosa", "Rudolf", "Sophie", "Simon", "Thea", "Theo", "Ursula", "Valentin",
    "Vera", "Walter", "Wilma", "Xaver", "Yara", "Yannik", "Zoe", "Ludwig", "Mathilde", "Friedrich",
)
