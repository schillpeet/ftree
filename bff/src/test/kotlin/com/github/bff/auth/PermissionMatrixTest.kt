package com.github.bff.auth

import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.auth.Permission.FAMILY_CREATE
import com.github.bff.auth.Permission.FAMILY_DELETE
import com.github.bff.auth.Permission.FAMILY_EDIT
import com.github.bff.auth.Permission.FAMILY_EXPORT
import com.github.bff.auth.Permission.FAMILY_MANAGE
import com.github.bff.auth.Permission.MEMBER_DELETE
import com.github.bff.auth.Permission.MEMBER_EDIT
import com.github.bff.auth.Permission.TREE_VIEW
import com.github.bff.auth.Permission.USERS_VIEW
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.HttpMethod
import org.springframework.http.HttpMethod.DELETE
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.http.HttpMethod.PUT
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class PermissionMatrixTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberships: Memberships

    // null means any signed-in user.
    private data class Endpoint(val method: HttpMethod, val path: String, val permission: Permission?, val body: MediaType? = null)

    private fun endpoints(family: UUID, member: UUID = UUID.randomUUID()) = listOf(
        Endpoint(GET, "/me", null),
        Endpoint(GET, "/users", USERS_VIEW),
        Endpoint(GET, "/admin/overview", USERS_VIEW),
        Endpoint(GET, "/admin/presence", USERS_VIEW),
        Endpoint(GET, "/admin/families", USERS_VIEW),
        Endpoint(GET, "/families", null),
        Endpoint(GET, "/families/$family/members", TREE_VIEW),
        Endpoint(GET, "/families/$family/photo", TREE_VIEW),
        Endpoint(GET, "/families/$family/members/$member/photo", TREE_VIEW),
        Endpoint(GET, "/families/$family/export", FAMILY_EXPORT),
        Endpoint(POST, "/families/$family/members", MEMBER_EDIT, MediaType.APPLICATION_JSON),
        Endpoint(PUT, "/families/$family/members/$member", MEMBER_EDIT, MediaType.APPLICATION_JSON),
        Endpoint(PUT, "/families/$family/members/$member/relatives", MEMBER_EDIT, MediaType.APPLICATION_JSON),
        Endpoint(PUT, "/families/$family/members/$member/placement", MEMBER_EDIT, MediaType.APPLICATION_JSON),
        Endpoint(PUT, "/families/$family/members/$member/photo", MEMBER_EDIT, MediaType.IMAGE_PNG),
        Endpoint(DELETE, "/families/$family/members/$member/photo", MEMBER_EDIT),
        Endpoint(PUT, "/families/$family", FAMILY_EDIT, MediaType.APPLICATION_JSON),
        Endpoint(PUT, "/families/$family/photo", FAMILY_EDIT, MediaType.IMAGE_PNG),
        Endpoint(DELETE, "/families/$family/photo", FAMILY_EDIT),
        Endpoint(PUT, "/families/$family/photo-fit", FAMILY_EDIT, MediaType.APPLICATION_JSON),
        Endpoint(DELETE, "/families/$family/members/$member", MEMBER_DELETE),
        Endpoint(POST, "/families", FAMILY_CREATE, MediaType.APPLICATION_JSON),
        Endpoint(PUT, "/families/order", FAMILY_MANAGE, MediaType.APPLICATION_JSON),
        Endpoint(POST, "/families/empty", FAMILY_CREATE, MediaType.APPLICATION_JSON),
        Endpoint(POST, "/families/import", FAMILY_CREATE, MediaType.APPLICATION_JSON),
        Endpoint(POST, "/families/$family/archive", FAMILY_MANAGE, MediaType.APPLICATION_JSON),
        Endpoint(POST, "/families/$family/anonymize", FAMILY_MANAGE, MediaType.APPLICATION_JSON),
        // Live: presence and change events.
        Endpoint(GET, "/families/$family/events?clientId=matrix", TREE_VIEW),
        Endpoint(PUT, "/families/$family/presence", TREE_VIEW, MediaType.APPLICATION_JSON),
        // Trash: a visible family is not in the trash, so these answer 404 to admins.
        Endpoint(GET, "/admin/trash", FAMILY_MANAGE),
        Endpoint(POST, "/admin/trash/$family/restore", FAMILY_MANAGE),
        Endpoint(DELETE, "/admin/trash/$family", FAMILY_MANAGE),
        // DELETE /families/{id} last: it removes the family the other requests use.
        Endpoint(DELETE, "/families/$family", FAMILY_DELETE),
    )

    private fun status(endpoint: Endpoint, email: String?): Int {
        val builder = request(endpoint.method, endpoint.path)
        email?.let { builder.header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = it)) }
        when (endpoint.body) {
            MediaType.APPLICATION_JSON -> builder.contentType(MediaType.APPLICATION_JSON).content("{}")
            MediaType.IMAGE_PNG -> builder.contentType(MediaType.IMAGE_PNG).content(byteArrayOf(1, 2, 3))
            else -> Unit
        }
        return mockMvc.perform(builder).andReturn().response.status
    }

    // A new family in which every non-admin has a membership, so the visibility filter's 404 never hides a 403.
    private fun visibleFamily(): UUID {
        val family = familyRepository.saveAndFlush(FamilyEntity(name = "Matrix ${UUID.randomUUID()}")).id
        memberships.grant(family, "visitor@example.com", Role.VISITOR, null)
        memberships.grant(family, "editor@example.com", Role.EDITOR, null)
        memberships.grant(family, "owner@example.com", Role.OWNER, null)
        memberships.grant(family, "creator@example.com", Role.VISITOR, null)
        return family
    }

    @Test
    fun `every endpoint requires the permission from the role concept`() {
        memberships.grantFlags("creator@example.com", admin = false, canCreateTrees = true, grantedBy = null)
        // Non-admins have the role of their membership in the family, plus the rights outside any family.
        val users = mapOf(
            "visitor@example.com" to Role.VISITOR.permissions + Access.NONE.permissions,
            "editor@example.com" to Role.EDITOR.permissions + Access.NONE.permissions,
            // Tree owners: an editor's rights plus deleting members and the tree, and sharing it (family.share), but
            // nothing outside their tree, so neither creating trees nor any admin endpoint.
            "owner@example.com" to Role.OWNER.permissions + Access.NONE.permissions,
            // can_create_trees replaces the global developer role: creating trees and the dev tools, nothing more in a
            // tree they only visit.
            "creator@example.com" to Role.VISITOR.permissions + Access(admin = false, canCreateTrees = true).permissions,
            "admin@example.com" to Permission.entries.toSet(),
        )
        val mismatches = users.flatMap { (email, permissions) ->
            val family = visibleFamily()
            endpoints(family).mapNotNull { endpoint ->
                val status = status(endpoint, email)
                val allowed = endpoint.permission == null || endpoint.permission in permissions
                val ok = if (allowed) status != 401 && status != 403 else status == 403
                if (ok) null else "$email ${endpoint.method} ${endpoint.path}: $status, expected ${if (allowed) "allowed" else "403"}"
            }
        }
        assertEquals(emptyList(), mismatches)
    }

    // Tree owners, which replace the global developer role: their rights end at their own tree, and whoever creates a
    // tree (can_create_trees) becomes its owner.
    @Test
    fun `owners act only in their own tree, and creating a tree makes its owner`() {
        visibleFamily()
        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Matrix other ${UUID.randomUUID()}")).id
        assertEquals(404, status(Endpoint(DELETE, "/families/$other", FAMILY_DELETE), "owner@example.com"))

        memberships.grantFlags("creator@example.com", admin = false, canCreateTrees = true, grantedBy = null)
        val json = mockMvc.perform(
            request(POST, "/families/empty")
                .header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "creator@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"name":"Matrix own ${UUID.randomUUID()}"}"""),
        ).andReturn().response.contentAsString
        assertEquals("owner", Regex(""""role":"(\w+)"""").find(json)?.groupValues?.get(1), json)
        val own = Regex(""""id":"([0-9a-f-]{36})"""").find(json)!!.groupValues[1]
        assertEquals(204, status(Endpoint(DELETE, "/families/$own", FAMILY_DELETE), "creator@example.com"))
    }

    @Test
    fun `requests without a valid token are unauthorized`() {
        val mismatches = endpoints(visibleFamily()).mapNotNull { endpoint ->
            status(endpoint, null).takeIf { it != 401 }?.let { "${endpoint.method} ${endpoint.path}: $it" }
        }
        assertEquals(emptyList(), mismatches)
    }

    @Test
    fun `unknown endpoints are denied`() {
        assertEquals(403, status(Endpoint(GET, "/actuator/env", null), "admin@example.com"))
        assertEquals(401, status(Endpoint(GET, "/actuator/env", null), null))
    }
}
