package com.github.bff.auth

// What one person may see: every family as admin, or the families listed by slug with a role each. firstFamily is the
// role in the first family without test settings, for the app.roles lists that predate the access file.
data class Access(val admin: Boolean, val families: Map<String, Role> = emptyMap(), val firstFamily: Role? = null) {
    // Permissions outside any family; everyone may change how the tree looks.
    val permissions: Set<Permission>
        get() = if (admin) Permission.entries.toSet() else setOf(Permission.TREE_APPEARANCE)

    companion object {
        val NONE = Access(admin = false)
    }
}
