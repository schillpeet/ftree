package com.github.bff.auth

import java.util.UUID

// What one person may see: every family as admin, or the families of their memberships in the database by family id,
// with a role each. adminElsewhere: an admin outside the admin application, who acts here as an ordinary user.
data class Access(
    val admin: Boolean,
    val canCreateTrees: Boolean = false,
    val memberships: Map<UUID, Role> = emptyMap(),
    val adminElsewhere: Boolean = false,
) {
    // Permissions outside any family: everyone may change how the tree looks and create trees (capped by
    // MAX_OWNED_TREES), canCreateTrees (users.can_create_trees) adds the dev tools that generate test families, and
    // admins may do everything.
    val permissions: Set<Permission>
        get() = when {
            admin -> Permission.entries.toSet()
            canCreateTrees -> setOf(Permission.TREE_APPEARANCE, Permission.FAMILY_CREATE, Permission.DEV_TOOLS)
            else -> setOf(Permission.TREE_APPEARANCE, Permission.FAMILY_CREATE)
        }

    companion object {
        val NONE = Access(admin = false)
    }
}
