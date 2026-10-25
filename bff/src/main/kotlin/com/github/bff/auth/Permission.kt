package com.github.bff.auth

// The key is the API value and the Spring Security authority name.
enum class Permission(val key: String) {
    TREE_VIEW("tree.view"),
    MEMBER_EDIT("member.edit"),
    FAMILY_EDIT("family.edit"),
    FAMILY_EXPORT("family.export"),
    MEMBER_DELETE("member.delete"),
    FAMILY_MANAGE("family.manage"),
    DEV_TOOLS("dev.tools"),
}
