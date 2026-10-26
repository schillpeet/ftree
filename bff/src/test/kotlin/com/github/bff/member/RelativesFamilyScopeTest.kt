package com.github.bff.member

import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.generated.model.CreateEmptyFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.put
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

// Not @Transactional: the trigger is checked against what is actually committed.
@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
class RelativesFamilyScopeTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var trash: TrashService

    @Autowired
    private lateinit var memberService: MemberService

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val admin by lazy { token(email = "admin@example.com") }

    private lateinit var family: UUID
    private lateinit var otherFamily: UUID
    private lateinit var anna: UUID
    private lateinit var stranger: UUID

    private fun newFamily() =
        (familyService.createEmpty(CreateEmptyFamilyRequest("Scope test ${UUID.randomUUID()}")) as FamilyCreationResult.CREATED).summary.id

    @BeforeTest
    fun createFamilies() {
        family = newFamily()
        otherFamily = newFamily()
        anna = memberService.create(family, CreateMemberRequest("Anna", "Müller"))!!.id
        stranger = memberService.create(otherFamily, CreateMemberRequest("Fremd", "Meier"))!!.id
    }

    @AfterTest
    fun deleteFamilies() {
        listOf(family, otherFamily).forEach { trash.trash(it); trash.purge(it) }
    }

    private fun putRelatives(body: String) = mockMvc.put("/families/$family/members/$anna/relatives") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
        contentType = MediaType.APPLICATION_JSON
        content = body
    }

    private fun assertRejected(body: String) {
        putRelatives(body).andExpect {
            status { isBadRequest() }
            content { contentType(MediaType.APPLICATION_PROBLEM_JSON) }
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM member_parents WHERE child_id IN (?, ?) OR parent_id IN (?, ?)", Int::class.java, anna, stranger, anna, stranger))
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM member_partners WHERE member_id IN (?, ?) OR partner_id IN (?, ?)", Int::class.java, anna, stranger, anna, stranger))
    }

    @Test
    fun `a parent of another family is rejected`() = assertRejected("""{"parentIds":["$stranger"],"childIds":[],"partnerIds":[]}""")

    @Test
    fun `a child of another family is rejected`() = assertRejected("""{"parentIds":[],"childIds":["$stranger"],"partnerIds":[]}""")

    @Test
    fun `a partner of another family is rejected`() = assertRejected("""{"parentIds":[],"childIds":[],"partnerIds":["$stranger"]}""")

    @Test
    fun `a sibling of another family is rejected`() {
        val parent = memberService.create(family, CreateMemberRequest("Paul", "Müller"))!!.id
        putRelatives(
            """{"parentIds":["$parent"],"childIds":[],"partnerIds":[],"siblings":[{"id":"$stranger","parentIds":["$parent"]}]}""",
        ).andExpect { status { isBadRequest() } }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM member_parents WHERE child_id = ?", Int::class.java, stranger))
    }

    @Test
    fun `an unknown id is answered like one of another family`() {
        val body = { id: UUID -> """{"parentIds":["$id"],"childIds":[],"partnerIds":[]}""" }
        val foreign = putRelatives(body(stranger)).andReturn().response.contentAsString
        val unknown = putRelatives(body(UUID.randomUUID())).andReturn().response.contentAsString
        val uuid = Regex("[0-9a-f]{8}-[0-9a-f-]{27}")
        assertEquals(foreign.replace(uuid, "X"), unknown.replace(uuid, "X"))
    }

    @Test
    fun `the database refuses parent links across families`() {
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update("INSERT INTO member_parents (child_id, parent_id) VALUES (?, ?)", anna, stranger)
        }
    }

    @Test
    fun `the database refuses partner links across families`() {
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update("INSERT INTO member_partners (member_id, partner_id) VALUES (?, ?)", anna, stranger)
        }
    }
}
