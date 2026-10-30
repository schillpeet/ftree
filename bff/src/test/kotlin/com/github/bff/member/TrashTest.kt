package com.github.bff.member

import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.generated.model.CreateMemberRequest
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
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class TrashTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberService: MemberService

    @Autowired
    private lateinit var trash: TrashService

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val admin = token(email = "admin@example.com")
    private lateinit var family: UUID
    private lateinit var name: String

    @BeforeTest
    fun createFamily() {
        at("2026-01-01T12:00:00Z")
        name = "Trash ${UUID.randomUUID()}"
        family = familyRepository.saveAndFlush(FamilyEntity(name = name, createdBy = "admin@example.com")).id
        memberService.create(family, CreateMemberRequest("Erna", "Trash"))
    }

    private fun at(instant: String) {
        trash.clock = Clock.fixed(Instant.parse(instant), ZoneOffset.UTC)
    }

    @AfterTest
    fun restoreClock() {
        trash.clock = Clock.systemUTC()
    }

    private fun trashIt() = mockMvc.delete("/families/$family") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }.andReturn().response.status

    private fun audit(action: String) =
        jdbc.queryForList("SELECT actor, details ->> 'name' AS name FROM audit_log WHERE action = ? AND target_id = ?", action, family.toString())

    @Test
    fun `a trashed family is invisible to admins on every family path`() {
        assertEquals(204, trashIt())

        listOf("/families/$family/members", "/families/$family/photo", "/families/$family/export").forEach { path ->
            mockMvc.get(path) { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }.andExpect { status { isNotFound() } }
        }
        mockMvc.put("/families/$family") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"Other"}"""
        }.andExpect { status { isNotFound() } }
        mockMvc.delete("/families/$family") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }.andExpect { status { isNotFound() } }
        mockMvc.get("/families") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }
            .andExpect { status { isOk() }; content { string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(family.toString()))) } }
        assertEquals(listOf(mapOf("actor" to "admin@example.com", "name" to name)), audit("family.trashed"))
    }

    @Test
    fun `the trash lists the family for admins only, with the date it is removed`() {
        trashIt()

        mockMvc.get("/admin/trash") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }.andExpect {
            status { isOk() }
            jsonPath("$[?(@.id == '$family')].name") { value(name) }
            jsonPath("$[?(@.id == '$family')].deletedBy") { value("admin@example.com") }
            jsonPath("$[?(@.id == '$family')].memberCount") { value(1) }
            jsonPath("$[?(@.id == '$family')].purgeAt") { value("2026-01-31T12:00:00Z") }
        }
        mockMvc.get("/admin/trash") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "editor@example.com")) }
            .andExpect { status { isForbidden() } }
    }

    @Test
    fun `restoring brings the family back with its members`() {
        trashIt()

        mockMvc.post("/admin/trash/$family/restore") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }.andExpect { status { isNoContent() } }

        mockMvc.get("/families/$family/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }
            .andExpect { status { isOk() }; jsonPath("$.length()") { value(1) } }
        val restored = familyRepository.findById(family).orElseThrow()
        assertNull(restored.deletedAt)
        assertNull(restored.deletedBy)
        assertEquals(1, audit("family.restored").size)
        mockMvc.post("/admin/trash/$family/restore") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `purging removes the family for good, and only from the trash`() {
        mockMvc.delete("/admin/trash/$family") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }.andExpect { status { isNotFound() } }
        assertTrue(familyRepository.existsById(family))
        trashIt()

        mockMvc.delete("/admin/trash/$family") { header(CLOUDFLARE_ACCESS_JWT_HEADER, admin) }.andExpect { status { isNoContent() } }

        assertFalse(familyRepository.existsById(family))
        assertEquals(listOf(mapOf("actor" to "admin@example.com", "name" to name)), audit("family.purged"))
    }

    @Test
    fun `the purger removes a family 30 days after it was trashed`() {
        trash.trash(family)

        at("2026-01-31T11:59:59Z")
        trash.purgeExpired()
        assertTrue(familyRepository.existsById(family))

        at("2026-01-31T12:00:00Z")
        assertTrue(trash.purgeExpired() >= 1)
        assertFalse(familyRepository.existsById(family))
        assertEquals(listOf(mapOf("actor" to null, "name" to name)), audit("family.purged"))
    }

    @Test
    fun `a name in the trash stays taken and says so`() {
        trashIt()

        mockMvc.post("/families/empty") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"${name.uppercase()}"}"""
        }.andExpect {
            status { isConflict() }
            jsonPath("$.code") { value("NAME_TAKEN") }
            jsonPath("$.detail") { value(org.hamcrest.Matchers.containsString("trash")) }
        }

        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Other ${UUID.randomUUID()}", createdBy = "admin@example.com")).id
        mockMvc.put("/families/$other") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"$name"}"""
        }.andExpect { status { isConflict() }; jsonPath("$.detail") { value(org.hamcrest.Matchers.containsString("trash")) } }
    }

    @Test
    fun `a name held by a visible family keeps the plain message`() {
        mockMvc.post("/families/empty") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"$name"}"""
        }.andExpect {
            status { isConflict() }
            jsonPath("$.detail") { value("A family with this name already exists.") }
        }
    }
}
