package com.github.bff.auth

// A role in one family: admins are admins in every family, developers are developers in the families they created.
enum class Role(val permissions: Set<Permission>) {
    VISITOR(setOf(Permission.TREE_VIEW)),
    EDITOR(VISITOR.permissions + setOf(Permission.MEMBER_EDIT, Permission.FAMILY_EDIT, Permission.FAMILY_EXPORT)),
    DEVELOPER(EDITOR.permissions + setOf(Permission.MEMBER_DELETE, Permission.FAMILY_DELETE)),
    ADMIN(Permission.entries.filter { it.perFamily }.toSet()),
}
