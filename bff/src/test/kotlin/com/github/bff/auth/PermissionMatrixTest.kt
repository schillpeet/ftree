package com.github.bff.auth

import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.auth.Permission.DEV_TOOLS
import com.github.bff.auth.Permission.FAMILY_CREATE
import com.github.bff.auth.Permission.FAMILY_DELETE
import com.github.bff.auth.Permission.FAMILY_EDIT
import com.github.bff.auth.Permission.FAMILY_EXPORT
import com.github.bff.auth.Permission.FAMILY_MANAGE
import com.github.bff.auth.Permission.FAMILY_SHARE
import com.github.bff.auth.Permission.MEMBER_DELETE
import com.github.bff.auth.Permission.MEMBER_EDIT
import com.github.bff.auth.Permission.TREE_VIEW
import com.github.bff.auth.Permission.USERS_MANAGE
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
import org.springframework.jdbc.core.JdbcTemplate
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

    @Autowired
    private lateinit var jdbc: JdbcTemplate

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
        Endpoint(POST, "/families", DEV_TOOLS, MediaType.APPLICATION_JSON),
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
        // Audit log: admins only.
        Endpoint(GET, "/admin/audit", USERS_VIEW),
        Endpoint(GET, "/admin/audit?limit=5&action=family.trashed", USERS_VIEW),
        Endpoint(GET, "/admin/audit/filters", USERS_VIEW),
        // Access: owners share their own tree, admins every tree and manage people. The bodies are empty, so allowed
        // writes answer 400 and unknown people 404.
        Endpoint(PUT, "/me", null, MediaType.APPLICATION_JSON),
        Endpoint(GET, "/families/$family/access", FAMILY_SHARE),
        Endpoint(PUT, "/families/$family/access", FAMILY_SHARE, MediaType.APPLICATION_JSON),
        Endpoint(DELETE, "/families/$family/access/$member", FAMILY_SHARE),
        Endpoint(POST, "/families/$family/owner", FAMILY_SHARE, MediaType.APPLICATION_JSON),
        Endpoint(GET, "/admin/users", USERS_VIEW),
        Endpoint(GET, "/admin/invitations", USERS_VIEW),
        Endpoint(PUT, "/admin/users/$member", USERS_MANAGE, MediaType.APPLICATION_JSON),
        Endpoint(POST, "/admin/users/$member/sessions/revoke", USERS_MANAGE),
        Endpoint(DELETE, "/admin/users/$member", USERS_MANAGE),
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
            // Tree owners: an editor's rights plus deleting members and the tree, and sharing it (family.share); outside
            // their tree only what everyone has (creating trees, but neither dev tools nor any admin endpoint).
            "owner@example.com" to Role.OWNER.permissions + Access.NONE.permissions,
            // can_create_trees now only adds the dev tools (generating test families), nothing more in a tree they
            // only visit.
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

    // Tree owners, which replace the global developer role: their rights end at their own tree, and whoever creates or
    // imports a tree, any signed-in user without a flag, becomes its owner.
    @Test
    fun `owners act only in their own tree, and creating a tree makes its owner`() {
        visibleFamily()
        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Matrix other ${UUID.randomUUID()}")).id
        assertEquals(404, status(Endpoint(DELETE, "/families/$other", FAMILY_DELETE), "owner@example.com"))

        fun create(path: String, body: String) = mockMvc.perform(
            request(POST, path)
                .header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "plain@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body),
        ).andReturn().response
        listOf(
            create("/families/empty", """{"name":"Matrix own ${UUID.randomUUID()}"}"""),
            create("/families/import", """{"name":"Matrix import ${UUID.randomUUID()}","gedcom":"0 HEAD\n0 @I1@ INDI\n1 NAME A /B/\n0 TRLR"}"""),
        ).forEach { response ->
            val json = response.contentAsString
            assertEquals(201, response.status, json)
            assertEquals("owner", Regex(""""role":"(\w+)"""").find(json)?.groupValues?.get(1), json)
            val own = Regex(""""id":"([0-9a-f-]{36})"""").find(json)!!.groupValues[1]
            assertEquals(204, status(Endpoint(DELETE, "/families/$own", FAMILY_DELETE), "plain@example.com"))
        }
    }

    // Access: an owner shares only their own tree, which another tree does not exist for, and editors and visitors may
    // neither see nor change who has access to theirs.
    @Test
    fun `owners share only their own tree`() {
        val own = visibleFamily()
        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Matrix other ${UUID.randomUUID()}")).id
        fun share(family: UUID, email: String) = mockMvc.perform(
            request(PUT, "/families/$family/access")
                .header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"guest@example.com","role":"visitor"}"""),
        ).andReturn().response.status

        assertEquals(404, status(Endpoint(GET, "/families/$other/access", FAMILY_SHARE), "owner@example.com"))
        assertEquals(404, share(other, "owner@example.com"))
        assertEquals(403, status(Endpoint(GET, "/families/$own/access", FAMILY_SHARE), "editor@example.com"))
        assertEquals(403, share(own, "editor@example.com"))
        assertEquals(403, share(own, "visitor@example.com"))
        assertEquals(200, share(own, "owner@example.com"))
        assertEquals(200, share(other, "admin@example.com"))
    }

    // Ending sessions: only admins, for people who exist; the tests run with the noop gateway, so Cloudflare is
    // unavailable and nothing goes into the audit log.
    @Test
    fun `only admins end someone's sessions`() {
        visibleFamily()
        val owner = jdbc.queryForObject("SELECT id FROM users WHERE email = 'owner@example.com'", UUID::class.java)
        fun revoke(user: UUID, email: String) = status(Endpoint(POST, "/admin/users/$user/sessions/revoke", USERS_MANAGE), email)

        assertEquals(403, revoke(owner!!, "owner@example.com"))
        assertEquals(403, revoke(owner, "creator@example.com"))
        assertEquals(404, revoke(UUID.randomUUID(), "admin@example.com"))
        assertEquals(503, revoke(owner, "admin@example.com"))
        assertEquals(
            0,
            jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action = 'user.sessions.revoked' AND target_id = 'owner@example.com'", Int::class.java),
        )
    }

    // Deleting a person: only admins, for people who exist, never themselves or someone who alone owns a tree.
    @Test
    fun `only admins delete people`() {
        val family = visibleFamily()
        val owner = jdbc.queryForObject("SELECT id FROM users WHERE email = 'owner@example.com'", UUID::class.java)!!
        memberships.grantFlags("admin@example.com", admin = true, canCreateTrees = false, grantedBy = null)
        val admin = jdbc.queryForObject("SELECT id FROM users WHERE email = 'admin@example.com'", UUID::class.java)!!
        fun delete(user: UUID, email: String) = status(Endpoint(DELETE, "/admin/users/$user", USERS_MANAGE), email)

        assertEquals(403, delete(owner, "owner@example.com"))
        assertEquals(403, delete(owner, "creator@example.com"))
        assertEquals(404, delete(UUID.randomUUID(), "admin@example.com"))
        assertEquals(400, delete(admin, "admin@example.com"))
        assertEquals(409, delete(owner, "admin@example.com"))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = 'owner@example.com'", Int::class.java))

        memberships.grant(family, "admin@example.com", Role.OWNER, null)
        assertEquals(204, delete(owner, "admin@example.com"))
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = 'owner@example.com'", Int::class.java))
        assertEquals(
            1,
            jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action = 'user.deleted' AND target_id = 'owner@example.com'", Int::class.java),
        )
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
