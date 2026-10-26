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

@SpringBootTest(properties = ["app.roles.admins=admin@example.com", "app.roles.editors=editor@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class PermissionMatrixTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    // null means any signed-in user.
    private data class Endpoint(val method: HttpMethod, val path: String, val permission: Permission?, val body: MediaType? = null)

    private fun endpoints(family: UUID, member: UUID = UUID.randomUUID()) = listOf(
        Endpoint(GET, "/me", null),
        Endpoint(GET, "/users", USERS_VIEW),
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

    // The visible family, so the visibility filter's 404 never hides a 403.
    private fun visibleFamily() =
        (familyRepository.findFirstByTotalUsersIsNullOrderByPositionAsc() ?: familyRepository.saveAndFlush(FamilyEntity(name = "Matrix ${UUID.randomUUID()}"))).id

    @Test
    fun `every endpoint requires the permission from the role concept`() {
        // With the app.roles lists, non-admins have their role in the first family, the visible one.
        val users = mapOf(
            "visitor@example.com" to Role.VISITOR.permissions + Access.NONE.permissions,
            "editor@example.com" to Role.EDITOR.permissions + Access.NONE.permissions,
            "admin@example.com" to Permission.entries.toSet(),
        )
        val mismatches = users.flatMap { (email, permissions) ->
            endpoints(visibleFamily()).mapNotNull { endpoint ->
                val status = status(endpoint, email)
                val allowed = endpoint.permission == null || endpoint.permission in permissions
                val ok = if (allowed) status != 401 && status != 403 else status == 403
                if (ok) null else "$email ${endpoint.method} ${endpoint.path}: $status, expected ${if (allowed) "allowed" else "403"}"
            }
        }
        assertEquals(emptyList(), mismatches)
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
