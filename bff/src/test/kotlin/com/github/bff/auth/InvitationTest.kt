package com.github.bff.auth

import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// An invitation into a tree waits for the invited person: until they accept it they may only look at the tree, and they
// may decline it, which removes their membership. Roles people give themselves or the BFF grants count at once.
@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class InvitationTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private lateinit var tree: FamilyEntity

    @BeforeTest
    fun createTree() {
        tree = familyRepository.saveAndFlush(FamilyEntity(name = "Invitation ${UUID.randomUUID()}"))
        memberships.grant(tree.id, OWNER, Role.OWNER, OWNER)
        memberships.grant(tree.id, INVITED, Role.EDITOR, OWNER)
    }

    private fun accept(email: String, family: UUID = tree.id) = mockMvc.post("/families/$family/invitation") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
    }

    private fun decline(email: String, family: UUID = tree.id) = mockMvc.delete("/families/$family/invitation") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
    }

    private fun addMember(email: String) = mockMvc.post("/families/${tree.id}/members") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
        contentType = MediaType.APPLICATION_JSON
        content = """{"firstName":"Ada","lastName":"Invited"}"""
    }

    private fun families(email: String) =
        mockMvc.get("/families") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }.andReturn().response.contentAsString

    private fun acceptedAt(email: String) =
        jdbc.query(
            "SELECT accepted_at FROM family_memberships WHERE family_id = ? AND email = ?",
            { rs, _ -> rs.getObject(1) }, tree.id, email,
        ).single()

    @Test
    fun `an invited editor only looks at the tree until they accept`() {
        addMember(INVITED).andExpect { status { isForbidden() } }
        val listed = families(INVITED)
        assert(Regex(""""id":"${tree.id}"[^}]*"role":"editor"""").containsMatchIn(listed)) { listed }
        assert(Regex(""""id":"${tree.id}"[^}]*"permissions":\["tree.view"]""").containsMatchIn(listed)) { listed }
        assert(Regex(""""id":"${tree.id}"[^}]*"invitationPending":true""").containsMatchIn(listed)) { listed }
        mockMvc.get("/families/${tree.id}/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = INVITED)) }
            .andExpect { status { isOk() } }

        accept(INVITED).andExpect {
            status { isOk() }
            jsonPath("$.role") { value("editor") }
            jsonPath("$.invitationPending") { value(false) }
            jsonPath("$.permissions[?(@ == 'member.edit')]") { exists() }
        }
        addMember(INVITED).andExpect { status { isCreated() } }
        // Accepting again changes nothing.
        accept(INVITED).andExpect { status { isOk() } }
        val audit = jdbc.queryForList(
            "SELECT action FROM audit_log WHERE target_id = ? AND action = 'membership.accepted'", String::class.java, tree.id.toString(),
        )
        assertEquals(listOf("membership.accepted"), audit)
    }

    @Test
    fun `roles people give themselves or the bff grants count at once`() {
        accept(OWNER).andExpect { jsonPath("$.invitationPending") { value(false) } }
        memberships.grant(tree.id, SEEDED, Role.EDITOR, null)
        addMember(OWNER).andExpect { status { isCreated() } }
        addMember(SEEDED).andExpect { status { isCreated() } }
        assertNull(acceptedAt(INVITED))
    }

    @Test
    fun `declining removes the membership, and only an open invitation can be declined`() {
        decline(OWNER).andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("INVALID_REQUEST") }
        }
        decline(INVITED).andExpect { status { isNoContent() } }
        assertEquals("[]", jdbc.queryForList(
            "SELECT email FROM family_memberships WHERE family_id = ? AND email = ?", String::class.java, tree.id, INVITED,
        ).toString())
        // The tree is gone for them now.
        accept(INVITED).andExpect { status { isNotFound() } }
        decline(INVITED).andExpect { status { isNotFound() } }
    }

    @Test
    fun `an admin without a membership has no invitation, and admins are never held back`() {
        accept(ADMIN).andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("INVALID_REQUEST") }
        }
        memberships.grant(tree.id, ADMIN, Role.VISITOR, OWNER)
        addMember(ADMIN).andExpect { status { isCreated() } }
    }

    private companion object {
        const val OWNER = "invitation-owner@example.com"
        const val INVITED = "invitation-editor@example.com"
        const val SEEDED = "invitation-seeded@example.com"
        const val ADMIN = "admin@example.com"
    }
}
