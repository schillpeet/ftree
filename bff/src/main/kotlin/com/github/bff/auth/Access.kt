package com.github.bff.auth

import java.util.UUID

// What one person may see: every family as admin, or the families listed by slug in the access file and the
// memberships in the database by family id, with a role each. firstFamily is the role in the first family without
// test settings, for the app.roles lists that predate the access file.
data class Access(
    val admin: Boolean,
    val families: Map<String, Role> = emptyMap(),
    val firstFamily: Role? = null,
    val developer: Boolean = false,
    val memberships: Map<UUID, Role> = emptyMap(),
) {
    // Permissions outside any family: everyone may change how the tree looks, developers may also create families
    // (test families with the dev tools included), and admins may do everything.
    val permissions: Set<Permission>
        get() = when {
            admin -> Permission.entries.toSet()
            developer -> setOf(Permission.TREE_APPEARANCE, Permission.FAMILY_CREATE, Permission.DEV_TOOLS)
            else -> setOf(Permission.TREE_APPEARANCE)
        }

    companion object {
        val NONE = Access(admin = false)
    }
}
