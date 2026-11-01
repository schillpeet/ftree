package com.github.bff.auth

import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.generated.model.ArchiveFamilyRequest
import com.github.bff.member.FamilyArchiveResult
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import com.github.bff.member.FamilyService
import com.github.bff.member.MemberEntity
import com.github.bff.member.MemberRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Which member of a tree the signed-in person is: one member per person and tree, one person per member, set by the
// person (member.edit) or by whoever shares the tree, and always removable by the person ("Nicht ich", tree.view).
@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class SelfMemberTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberRepository: MemberRepository

    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private lateinit var tree: FamilyEntity
    private lateinit var ada: UUID
    private lateinit var bert: UUID

    @BeforeTest
    fun createTree() {
        tree = familyRepository.saveAndFlush(FamilyEntity(name = "Self ${UUID.randomUUID()}"))
        ada = member(tree, "Ada")
        bert = member(tree, "Bert")
        memberships.grant(tree.id, OWNER, Role.OWNER, null)
        memberships.grant(tree.id, EDITOR, Role.EDITOR, null)
        memberships.grant(tree.id, VISITOR, Role.VISITOR, null)
    }

    private fun member(family: FamilyEntity, firstName: String): UUID =
        memberRepository.saveAndFlush(MemberEntity(firstName = firstName, lastName = "Self", family = family)).id

    private fun link(email: String, member: UUID, family: UUID = tree.id) = mockMvc.put("/families/$family/self") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
        contentType = MediaType.APPLICATION_JSON
        content = """{"memberId":"$member"}"""
    }

    private fun unlink(email: String, family: UUID = tree.id) = mockMvc.delete("/families/$family/self") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
    }

    // selfMemberId of the family in the caller's GET /families; "absent" when the family is not listed.
    private fun selfMemberIn(email: String, family: UUID = tree.id): String {
        val json = mockMvc.get("/families") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }.andReturn().response.contentAsString
        return Regex(""""id":"$family".*?"selfMemberId":(null|"[0-9a-f-]{36}")""").find(json)?.groupValues?.get(1)?.trim('"') ?: "absent"
    }

    private fun stored(email: String, family: UUID = tree.id): UUID? =
        jdbc.query(
            "SELECT member_id FROM family_memberships WHERE family_id = ? AND email = ?",
            { rs, _ -> rs.getObject(1, UUID::class.java) }, family, email,
        ).single()

    @Test
    fun `an editor links themselves and sees it in their family list only`() {
        link(EDITOR, ada).andExpect {
            status { isOk() }
            jsonPath("$.id") { value(tree.id.toString()) }
            jsonPath("$.selfMemberId") { value(ada.toString()) }
            jsonPath("$.role") { value("editor") }
        }

        assertEquals(ada.toString(), selfMemberIn(EDITOR))
        assertEquals("null", selfMemberIn(OWNER))
        assertEquals(ada, stored(EDITOR))
        val audit = jdbc.queryForList(
            "SELECT action || ' ' || actor || ' ' || details::text FROM audit_log WHERE target_id = ? AND action LIKE 'membership.member.%'",
            String::class.java, tree.id.toString(),
        )
        assertEquals(listOf("""membership.member.linked $EDITOR {"email": "$EDITOR", "member": "$ada"}"""), audit)
    }

    @Test
    fun `linking again moves the link, so a person is one member per tree`() {
        link(EDITOR, ada).andExpect { status { isOk() } }
        link(EDITOR, ada).andExpect { status { isOk() } }
        link(EDITOR, bert).andExpect { status { isOk() } }

        assertEquals(bert, stored(EDITOR))
        // Ada is free again for someone else.
        link(OWNER, ada).andExpect { status { isOk() } }
        assertEquals(ada, stored(OWNER))
    }

    @Test
    fun `a member taken by someone else answers 409 without naming them`() {
        link(OWNER, ada).andExpect { status { isOk() } }

        val response = link(EDITOR, ada).andExpect {
            status { isConflict() }
            jsonPath("$.code") { value("MEMBER_TAKEN") }
        }.andReturn().response.contentAsString

        assertFalse(OWNER in response || OWNER.substringBefore('@') in response, response)
        assertNull(stored(EDITOR))
        assertEquals(ada, stored(OWNER))
    }

    @Test
    fun `a visitor cannot link themselves but can always remove their link`() {
        link(VISITOR, ada).andExpect { status { isForbidden() } }
        assertNull(stored(VISITOR))

        // Someone sharing the tree may name the member; the visitor can still say "Nicht ich".
        jdbc.update("UPDATE family_memberships SET member_id = ? WHERE family_id = ? AND email = ?", ada, tree.id, VISITOR)
        assertEquals(ada.toString(), selfMemberIn(VISITOR))
        unlink(VISITOR).andExpect { status { isNoContent() } }
        assertNull(stored(VISITOR))
        assertEquals("null", selfMemberIn(VISITOR))
        // Again, and without any link: still 204.
        unlink(VISITOR).andExpect { status { isNoContent() } }
        unlink(EDITOR).andExpect { status { isNoContent() } }
    }

    @Test
    fun `a tree the caller cannot see stays 404, and so does a member of another tree`() {
        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Self other ${UUID.randomUUID()}"))
        val stranger = member(other, "Clara")
        memberships.grant(other.id, OUTSIDER, Role.OWNER, null)

        link(EDITOR, stranger, other.id).andExpect { status { isNotFound() } }
        unlink(EDITOR, other.id).andExpect { status { isNotFound() } }
        link(EDITOR, stranger).andExpect {
            status { isNotFound() }
            jsonPath("$.code") { value("NOT_FOUND") }
        }
        link(EDITOR, UUID.randomUUID()).andExpect { status { isNotFound() } }
        assertNull(stored(EDITOR))
        assertEquals("absent", selfMemberIn(EDITOR, other.id))
    }

    @Test
    fun `an admin without a membership has no self member and cannot set one`() {
        assertEquals("null", selfMemberIn(SELF_ADMIN))
        link(SELF_ADMIN, ada).andExpect {
            status { isBadRequest() }
            jsonPath("$.code") { value("INVALID_REQUEST") }
        }
        unlink(SELF_ADMIN).andExpect { status { isNoContent() } }

        // With a membership an admin is linked like anyone else.
        memberships.grant(tree.id, SELF_ADMIN, Role.VISITOR, null)
        link(SELF_ADMIN, ada).andExpect { status { isOk() } }
        assertEquals(ada.toString(), selfMemberIn(SELF_ADMIN))
    }

    @Test
    fun `deleting the member removes the link`() {
        link(EDITOR, ada).andExpect { status { isOk() } }

        mockMvc.delete("/families/${tree.id}/members/$ada") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = OWNER)) }
            .andExpect { status { isNoContent() } }
        memberRepository.flush()

        assertNull(stored(EDITOR))
        assertEquals("null", selfMemberIn(EDITOR))
    }

    @Test
    fun `moving the members into another family removes their links`() {
        link(EDITOR, ada).andExpect { status { isOk() } }

        val result = familyService.archive(tree.id, ArchiveFamilyRequest("Self archive ${UUID.randomUUID()}"))

        assertTrue(result is FamilyArchiveResult.ARCHIVED, result.toString())
        assertNull(stored(EDITOR))
    }

    @Test
    fun `revoking the membership removes the link with it`() {
        link(EDITOR, ada).andExpect { status { isOk() } }
        jdbc.update("DELETE FROM family_memberships WHERE family_id = ? AND email = ?", tree.id, EDITOR)
        link(OWNER, ada).andExpect { status { isOk() } }
    }

    @Test
    fun `the database keeps one person per member and the member inside the tree`() {
        link(EDITOR, ada).andExpect { status { isOk() } }
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update("UPDATE family_memberships SET member_id = ? WHERE family_id = ? AND email = ?", ada, tree.id, OWNER)
        }
    }

    @Test
    fun `the database refuses a member of another family`() {
        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Self other ${UUID.randomUUID()}"))
        val stranger = member(other, "Clara")
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update("UPDATE family_memberships SET member_id = ? WHERE family_id = ? AND email = ?", stranger, tree.id, OWNER)
        }
    }

    private companion object {
        const val OWNER = "self-owner@example.com"
        const val EDITOR = "self-editor@example.com"
        const val VISITOR = "self-visitor@example.com"
        const val OUTSIDER = "self-outsider@example.com"
    }
}

// The admin of the shared test context, so this class needs no context of its own.
private const val SELF_ADMIN = "admin@example.com"
