package com.github.bff.auth

import com.github.bff.auth.Permission.DEV_TOOLS
import com.github.bff.auth.Permission.FAMILY_EDIT
import com.github.bff.auth.Permission.FAMILY_EXPORT
import com.github.bff.auth.Permission.FAMILY_MANAGE
import com.github.bff.auth.Permission.MEMBER_DELETE
import com.github.bff.auth.Permission.MEMBER_EDIT
import com.github.bff.auth.Permission.TREE_APPEARANCE
import com.github.bff.auth.Permission.TREE_VIEW
import kotlin.test.Test
import kotlin.test.assertEquals

class RoleTest {
    @Test
    fun `roles in a family grant the permissions from the role concept`() {
        assertEquals(setOf(TREE_VIEW), Role.VISITOR.permissions)
        assertEquals(setOf(TREE_VIEW, MEMBER_EDIT, FAMILY_EDIT, FAMILY_EXPORT), Role.EDITOR.permissions)
        assertEquals(setOf(TREE_VIEW, MEMBER_EDIT, FAMILY_EDIT, FAMILY_EXPORT, MEMBER_DELETE), Role.ADMIN.permissions)
    }

    @Test
    fun `everyone may change the appearance, only admins manage families and use dev tools`() {
        assertEquals(setOf(TREE_APPEARANCE), Access(admin = false).permissions)
        assertEquals(Permission.entries.toSet(), Access(admin = true).permissions)
        assertEquals(setOf(TREE_APPEARANCE, FAMILY_MANAGE, DEV_TOOLS), Permission.entries.filterNot { it.perFamily }.toSet())
    }

    @Test
    fun `permission keys match the API`() {
        assertEquals(
            listOf("tree.view", "member.edit", "family.edit", "family.export", "member.delete", "tree.appearance", "family.manage", "dev.tools"),
            Permission.entries.map { it.key },
        )
    }
}
