package com.github.bff.auth

import org.yaml.snakeyaml.LoaderOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor

// One person of the access file: families maps family slugs to their role there.
data class AccessFileEntry(
    val admin: Boolean,
    val families: Map<String, Role> = emptyMap(),
    val developer: Boolean = false,
)

// Parses the access file, keyed by trimmed, lowercased email:
//
//   people:
//     - email: admin@example.com
//       admin: true             # a bootstrap admin, admin whatever the database says
//     - email: developer@example.com
//       developer: true         # imported once as users.can_create_trees
//     - email: someone@example.com
//       trees:
//         schiller: editor      # imported once as a membership: exactly one family slug and editor or visitor
//
// Only the admins apply at runtime; MembershipSeed imports everything else into the database once, after which the
// database alone decides. Any mistake fails with a message naming the entry, so the BFF does not start with a
// half-read file.
fun parseAccessFile(text: String): Map<String, AccessFileEntry> {
    val root = Yaml(SafeConstructor(LoaderOptions())).load<Any?>(text)
    if (root !is Map<*, *> || root.keys != setOf("people")) invalid("expected a single top-level key \"people\"")
    val people = root["people"] as? List<*> ?: invalid("\"people\" must be a list")
    val result = linkedMapOf<String, AccessFileEntry>()
    people.forEachIndexed { index, entry ->
        val where = "people[$index]"
        if (entry !is Map<*, *>) invalid("$where must be a map")
        val unknown = entry.keys - setOf("email", "admin", "developer", "trees")
        if (unknown.isNotEmpty()) invalid("$where has unknown keys $unknown")
        val email = (entry["email"] as? String)?.normalizedEmail()
        if (email.isNullOrEmpty() || '@' !in email) invalid("$where needs an email")
        val admin = flag(entry, "admin", where)
        val developer = flag(entry, "developer", where)
        val families = when (val value = entry["trees"]) {
            null -> emptyMap()
            is Map<*, *> -> value.entries.associate { (slug, role) -> familyRole("$where ($email)", slug, role) }
            else -> invalid("$where: trees must map family slugs to editor or visitor")
        }
        if (admin && developer) invalid("$where ($email): an admin is already everything a developer is; set only admin")
        if (admin && families.isNotEmpty()) invalid("$where ($email): an admin sees every tree, so list no trees")
        if (!admin && !developer && families.size != 1) {
            invalid("$where ($email): editors and visitors need exactly one tree, not ${families.size}")
        }
        if (result.put(email, AccessFileEntry(admin, families, developer)) != null) invalid("$email is listed twice")
    }
    return result
}

private fun flag(entry: Map<*, *>, key: String, where: String): Boolean =
    when (val value = entry[key]) {
        null -> false
        is Boolean -> value
        else -> invalid("$where: $key must be true or false")
    }

private fun familyRole(where: String, slug: Any?, role: Any?): Pair<String, Role> {
    if (slug !is String || !SLUG.matches(slug)) invalid("$where: \"$slug\" is not a family slug")
    val parsed = when (role) {
        "editor" -> Role.EDITOR
        "visitor" -> Role.VISITOR
        else -> invalid("$where: the role in $slug must be editor or visitor, not \"$role\"")
    }
    return slug to parsed
}

fun String.normalizedEmail() = trim().lowercase()

private val SLUG = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

private fun invalid(message: String): Nothing = throw IllegalArgumentException("Invalid access file: $message")
