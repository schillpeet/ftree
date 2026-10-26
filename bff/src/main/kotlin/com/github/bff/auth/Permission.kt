package com.github.bff.auth

// The key is the API value and the Spring Security authority name. Family permissions apply to one family and come
// from the role in it; the others apply everywhere.
enum class Permission(val key: String, val perFamily: Boolean) {
    TREE_VIEW("tree.view", true),
    MEMBER_EDIT("member.edit", true),
    FAMILY_EDIT("family.edit", true),
    FAMILY_EXPORT("family.export", true),
    MEMBER_DELETE("member.delete", true),
    FAMILY_DELETE("family.delete", true),
    FAMILY_SHARE("family.share", true),
    TREE_APPEARANCE("tree.appearance", false),
    FAMILY_CREATE("family.create", false),
    FAMILY_MANAGE("family.manage", false),
    DEV_TOOLS("dev.tools", false),
    USERS_VIEW("users.view", false),
    USERS_MANAGE("users.manage", false),
}
