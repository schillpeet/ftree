package com.github.bff.auth

import java.util.UUID

// What one person may see: every family as admin, or the families of their memberships in the database by family id,
// with a role each.
data class Access(
    val admin: Boolean,
    val canCreateTrees: Boolean = false,
    val memberships: Map<UUID, Role> = emptyMap(),
) {
    // Permissions outside any family: everyone may change how the tree looks, people who may create trees may also
    // create families (test families with the dev tools included), and admins may do everything.
    val permissions: Set<Permission>
        get() = when {
            admin -> Permission.entries.toSet()
            canCreateTrees -> setOf(Permission.TREE_APPEARANCE, Permission.FAMILY_CREATE, Permission.DEV_TOOLS)
            else -> setOf(Permission.TREE_APPEARANCE)
        }

    companion object {
        val NONE = Access(admin = false)
    }
}
