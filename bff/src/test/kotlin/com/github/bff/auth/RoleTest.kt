package com.github.bff.auth

import com.github.bff.auth.Permission.DEV_TOOLS
import com.github.bff.auth.Permission.FAMILY_CREATE
import com.github.bff.auth.Permission.FAMILY_DELETE
import com.github.bff.auth.Permission.FAMILY_EDIT
import com.github.bff.auth.Permission.FAMILY_EXPORT
import com.github.bff.auth.Permission.FAMILY_MANAGE
import com.github.bff.auth.Permission.FAMILY_SHARE
import com.github.bff.auth.Permission.MEMBER_DELETE
import com.github.bff.auth.Permission.MEMBER_EDIT
import com.github.bff.auth.Permission.TREE_APPEARANCE
import com.github.bff.auth.Permission.TREE_VIEW
import com.github.bff.auth.Permission.USERS_MANAGE
import com.github.bff.auth.Permission.USERS_VIEW
import kotlin.test.Test
import kotlin.test.assertEquals

class RoleTest {
    @Test
    fun `roles in a family grant the permissions from the role concept`() {
        assertEquals(setOf(TREE_VIEW), Role.VISITOR.permissions)
        assertEquals(setOf(TREE_VIEW, MEMBER_EDIT, FAMILY_EDIT, FAMILY_EXPORT), Role.EDITOR.permissions)
        assertEquals(setOf(TREE_VIEW, MEMBER_EDIT, FAMILY_EDIT, FAMILY_EXPORT, MEMBER_DELETE, FAMILY_DELETE, FAMILY_SHARE), Role.OWNER.permissions)
        assertEquals(Role.OWNER.permissions, Role.ADMIN.permissions)
    }

    @Test
    fun `everyone may change the appearance and create trees, the flag adds the dev tools, only admins manage families`() {
        assertEquals(setOf(TREE_APPEARANCE, FAMILY_CREATE), Access(admin = false).permissions)
        assertEquals(setOf(TREE_APPEARANCE, FAMILY_CREATE, DEV_TOOLS), Access(admin = false, canCreateTrees = true).permissions)
        assertEquals(Permission.entries.toSet(), Access(admin = true).permissions)
        assertEquals(
            setOf(TREE_APPEARANCE, FAMILY_CREATE, FAMILY_MANAGE, DEV_TOOLS, USERS_VIEW, USERS_MANAGE),
            Permission.entries.filterNot { it.perFamily }.toSet(),
        )
    }

    @Test
    fun `permission keys match the API`() {
        assertEquals(
            listOf(
                "tree.view", "member.edit", "family.edit", "family.export", "member.delete", "family.delete", "family.share",
                "tree.appearance", "family.create", "family.manage", "dev.tools", "users.view", "users.manage",
            ),
            Permission.entries.map { it.key },
        )
    }
}
