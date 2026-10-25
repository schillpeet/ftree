package com.github.bff.auth

import org.yaml.snakeyaml.LoaderOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor

// Parses the access file, keyed by trimmed, lowercased email:
//
//   people:
//     - email: admin@example.com
//       admin: true
//     - email: someone@example.com
//       trees:
//         schiller: editor      # a family slug and editor or visitor
//
// Any mistake fails with a message naming the entry, so the BFF does not start with a half-read file.
fun parseAccessFile(text: String): Map<String, Access> {
    val root = Yaml(SafeConstructor(LoaderOptions())).load<Any?>(text)
    if (root !is Map<*, *> || root.keys != setOf("people")) invalid("expected a single top-level key \"people\"")
    val people = root["people"] as? List<*> ?: invalid("\"people\" must be a list")
    val result = linkedMapOf<String, Access>()
    people.forEachIndexed { index, entry ->
        val where = "people[$index]"
        if (entry !is Map<*, *>) invalid("$where must be a map")
        val unknown = entry.keys - setOf("email", "admin", "trees")
        if (unknown.isNotEmpty()) invalid("$where has unknown keys $unknown")
        val email = (entry["email"] as? String)?.normalizedEmail()
        if (email.isNullOrEmpty() || '@' !in email) invalid("$where needs an email")
        val admin = when (val value = entry["admin"]) {
            null -> false
            is Boolean -> value
            else -> invalid("$where: admin must be true or false")
        }
        val families = when (val value = entry["trees"]) {
            null -> emptyMap()
            is Map<*, *> -> value.entries.associate { (slug, role) -> familyRole("$where ($email)", slug, role) }
            else -> invalid("$where: trees must map family slugs to editor or visitor")
        }
        if (admin && families.isNotEmpty()) invalid("$where ($email): an admin sees every tree, so list no trees")
        if (result.put(email, Access(admin, families)) != null) invalid("$email is listed twice")
    }
    return result
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
