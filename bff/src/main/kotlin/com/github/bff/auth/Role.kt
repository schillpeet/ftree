package com.github.bff.auth

enum class Role(val permissions: Set<Permission>) {
    VISITOR(setOf(Permission.TREE_VIEW)),
    EDITOR(VISITOR.permissions + setOf(Permission.MEMBER_EDIT, Permission.FAMILY_EDIT, Permission.FAMILY_EXPORT)),
    ADMIN(Permission.entries.toSet()),
}
