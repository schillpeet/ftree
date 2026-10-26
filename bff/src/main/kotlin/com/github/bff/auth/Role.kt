package com.github.bff.auth

// A role in one family: admins are admins in every family, owners own the families they created or were given, with
// the right to delete and share them.
enum class Role(val permissions: Set<Permission>) {
    VISITOR(setOf(Permission.TREE_VIEW)),
    EDITOR(VISITOR.permissions + setOf(Permission.MEMBER_EDIT, Permission.FAMILY_EDIT, Permission.FAMILY_EXPORT)),
    OWNER(EDITOR.permissions + setOf(Permission.MEMBER_DELETE, Permission.FAMILY_DELETE, Permission.FAMILY_SHARE)),
    ADMIN(Permission.entries.filter { it.perFamily }.toSet()),
}
