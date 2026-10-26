package com.github.bff.live

import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
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
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Not transactional: the events go out only after a commit.
@SpringBootTest(properties = ["app.roles.admins=admin@example.com", "app.roles.editors=editor@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
class TreeEventsTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var presence: PresenceRegistry

    @Autowired
    private lateinit var broadcaster: TreeEventBroadcaster

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private lateinit var visible: UUID
    private lateinit var hidden: UUID
    private val created = mutableListOf<UUID>()

    @BeforeTest
    fun createFamilies() {
        // The editor's role is in the first family without test settings; a new one listed first leaves the others alone.
        visible = familyRepository.saveAndFlush(FamilyEntity(name = "Live ${UUID.randomUUID()}")).id.also(created::add)
        jdbc.update("UPDATE families SET position = (SELECT min(position) - 1 FROM families) WHERE id = ?", visible)
        hidden = familyRepository.saveAndFlush(
            FamilyEntity(name = "Live test ${UUID.randomUUID()}", totalUsers = 1, generationCount = 1, minChildren = 0, maxChildren = 0),
        ).id.also(created::add)
    }

    @AfterTest
    fun deleteFamilies() {
        broadcaster.closeAll()
        created.forEach { id -> mockMvc.delete("/families/$id") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token()) } }
    }

    private fun stream(family: UUID, email: String, clientId: String = "tab-${email.substringBefore('@')}"): MvcResult =
        mockMvc.get("/families/$family/events?clientId=$clientId") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }
            .andExpect {
                request { asyncStarted() }
                status { isOk() }
                header { string("Cache-Control", "no-cache, no-transform") }
            }.andReturn()

    // Spring writes each event as "event:<name>" and "data:<json>" lines followed by a blank line.
    private data class Event(val name: String, val data: String)

    private fun MvcResult.events(): List<Event> =
        response.contentAsString.split("\n\n").mapNotNull { block ->
            val lines = block.lines()
            val name = lines.firstOrNull { it.startsWith("event:") }?.removePrefix("event:") ?: return@mapNotNull null
            Event(name, lines.first { it.startsWith("data:") }.removePrefix("data:"))
        }

    private fun createMember(family: UUID, email: String): String =
        mockMvc.post("/families/$family/members") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
            contentType = MediaType.APPLICATION_JSON
            content = """{"firstName":"Live","lastName":"Test"}"""
        }.andExpect { status { isCreated() } }.andReturn().response.contentAsString.let { Regex(""""id":"([0-9a-f-]{36})"""").find(it)!!.groupValues[1] }

    @Test
    fun `a stream starts with the presence and gets every saved change after commit`() {
        val editor = stream(visible, "editor@example.com")
        assertEquals("presence", editor.events().first().name)
        assertTrue(""""email":"editor@example.com","initials":"E","admin":false""" in editor.events().first().data)

        val admin = stream(visible, "admin@example.com")
        assertTrue(""""email":"admin@example.com","initials":"A","admin":true""" in editor.events().last().data, "the editor sees the admin arrive")

        val member = createMember(visible, "admin@example.com")
        assertEquals(Event("member-changed", """{"memberId":"$member","by":"admin@example.com"}"""), editor.events().last())

        mockMvc.put("/families/$visible/presence") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "editor@example.com"))
            contentType = MediaType.APPLICATION_JSON
            content = """{"clientId":"tab-editor","viewing":"$member","editing":"$member","idle":true}"""
        }.andExpect { status { isNoContent() } }
        val snapshot = admin.events().last()
        assertEquals("presence", snapshot.name)
        assertTrue(""""clientId":"tab-editor","email":"editor@example.com","initials":"E","admin":false,"idle":true,"editing":"$member","viewing":"$member"""" in snapshot.data, snapshot.data)

        mockMvc.delete("/families/$visible/members/$member") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token()) }
            .andExpect { status { isNoContent() } }
        assertEquals(Event("member-deleted", """{"memberId":"$member","by":"admin@example.com"}"""), editor.events().last())
        assertEquals(editor.events().last(), admin.events().last())
    }

    @Test
    fun `families the user cannot see answer 404 and send them nothing`() {
        mockMvc.get("/families/$hidden/events?clientId=tab") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "editor@example.com")) }
            .andExpect { status { isNotFound() } }
        mockMvc.put("/families/$hidden/presence") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "editor@example.com"))
            contentType = MediaType.APPLICATION_JSON
            content = """{"clientId":"tab","idle":false}"""
        }.andExpect { status { isNotFound() } }
        mockMvc.get("/families/${UUID.randomUUID()}/events?clientId=tab") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token()) }
            .andExpect { status { isNotFound() } }

        val editor = stream(visible, "editor@example.com")
        val admin = stream(hidden, "admin@example.com")
        createMember(hidden, "admin@example.com")

        assertEquals(listOf("member-changed"), admin.events().map { it.name }.filter { it != "presence" })
        assertTrue(editor.events().none { "admin@example.com" in it.data }, "the editor sees neither the admin in the hidden family nor its changes")
    }

    @Test
    fun `presence may only name members of the family`() {
        val other = familyRepository.saveAndFlush(FamilyEntity(name = "Live other ${UUID.randomUUID()}")).id.also(created::add)
        val stranger = createMember(other, "admin@example.com")
        listOf("viewing", "editing").forEach { field ->
            listOf(stranger, UUID.randomUUID().toString()).forEach { id ->
                mockMvc.put("/families/$visible/presence") {
                    header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "editor@example.com"))
                    contentType = MediaType.APPLICATION_JSON
                    content = """{"clientId":"tab","$field":"$id","idle":false}"""
                }.andExpect {
                    status { isBadRequest() }
                    jsonPath("$.code") { value("INVALID_REQUEST") }
                }
            }
        }
        assertEquals(emptyList(), presence.inFamily(visible))
    }

    @Test
    fun `a malformed client id is rejected`() {
        listOf("", "a b", "x".repeat(65)).forEach { clientId ->
            mockMvc.get("/families/$visible/events?clientId=$clientId") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token()) }
                .andExpect { status { isBadRequest() } }
        }
        mockMvc.get("/families/$visible/events") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token()) }
            .andExpect { status { isBadRequest() } }
    }

    @Test
    fun `deleting a family tells its streams, ends them, and clears its presence`() {
        val family = familyRepository.saveAndFlush(FamilyEntity(name = "Live delete ${UUID.randomUUID()}")).id
        val admin = stream(family, "admin@example.com")
        assertEquals(1, presence.inFamily(family).size)

        mockMvc.delete("/families/$family") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token()) }.andExpect { status { isNoContent() } }

        assertEquals(Event("family-changed", """{"familyId":"$family","by":"admin@example.com"}"""), admin.events().last())
        assertEquals(emptyList(), presence.inFamily(family))
    }

    @Test
    fun `renaming a family sends family-changed`() {
        val family = familyRepository.saveAndFlush(FamilyEntity(name = "Live rename ${UUID.randomUUID()}")).id.also(created::add)
        val admin = stream(family, "admin@example.com")

        mockMvc.put("/families/$family") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token())
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"Live renamed ${UUID.randomUUID()}"}"""
        }.andExpect { status { isOk() } }

        assertEquals(Event("family-changed", """{"familyId":"$family","by":"admin@example.com"}"""), admin.events().last())
    }
}
