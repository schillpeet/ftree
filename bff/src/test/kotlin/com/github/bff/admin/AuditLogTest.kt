package com.github.bff.admin

import com.github.bff.auth.AuditLog
import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
import com.github.bff.auth.CloudflareTestTokens.token
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(properties = ["app.roles.admins=admin@example.com", "app.roles.editors=editor@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class AuditLogTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var auditLog: AuditLog

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val json = JsonMapper()

    private fun fetch(path: String): JsonNode =
        json.readTree(
            mockMvc.get(path) { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
                .andExpect { status { isOk() } }.andReturn().response.contentAsString,
        )

    // The given field of every element of an array node.
    private fun JsonNode.strings(vararg path: String): List<String> =
        (0 until size()).map { index -> path.fold(get(index)) { node, key -> node[key] }.asString() }

    private fun user(email: String, name: String?): UUID {
        val id = UUID.randomUUID()
        jdbc.update("INSERT INTO users (email, id, display_name) VALUES (?, ?, ?)", email, id, name)
        return id
    }

    @Test
    fun `pages run newest first and chain through next`() {
        val action = "test.paging.${UUID.randomUUID()}"
        repeat(5) { auditLog.record("a@example.com", action, "family", UUID.randomUUID().toString(), mapOf("n" to "$it")) }

        val first = fetch("/admin/audit?action=$action&limit=2")
        assertEquals(listOf("4", "3"), first["entries"].strings("details", "n"))
        val second = fetch("/admin/audit?action=$action&limit=2&before=${first["next"].asLong()}")
        assertEquals(listOf("2", "1"), second["entries"].strings("details", "n"))
        val last = fetch("/admin/audit?action=$action&limit=2&before=${second["next"].asLong()}")
        assertEquals(listOf("0"), last["entries"].strings("details", "n"))
        assertTrue(last["next"].isNull, "the last page has no next")
    }

    @Test
    fun `filters match the person, the tree, and the action`() {
        val actorEmail = "actor-${UUID.randomUUID()}@example.com"
        val subjectEmail = "subject-${UUID.randomUUID()}@example.com"
        val actor = user(actorEmail, "Ada Actor")
        val subject = user(subjectEmail, null)
        val family = UUID.randomUUID()
        auditLog.record(actorEmail, "family.trashed", "family", family.toString(), mapOf("name" to "Gone"))
        auditLog.record(actorEmail, "user.admin.granted", "user", subjectEmail)
        auditLog.record(null, "family.purged", "family", family.toString(), mapOf("name" to "Gone", "reason" to "expired"))
        auditLog.record("other@example.com", "user.admin.granted", "user", "other-${UUID.randomUUID()}@example.com")

        fun actions(query: String) = fetch("/admin/audit?$query")["entries"].strings("action")
        assertEquals(listOf("user.admin.granted", "family.trashed"), actions("userId=$actor"), "made by the actor")
        assertEquals(listOf("user.admin.granted"), actions("userId=$subject"), "about the subject")
        assertEquals(listOf("family.purged", "family.trashed"), actions("familyId=$family"))
        assertEquals(listOf("family.purged"), actions("familyId=$family&action=family.purged"))
        assertEquals(emptyList(), actions("userId=${UUID.randomUUID()}"), "an unknown person matches nothing")

        val entry = fetch("/admin/audit?userId=$actor&action=family.trashed")["entries"][0]
        assertEquals(actorEmail, entry["actor"].asString())
        assertEquals(actor.toString(), entry["actorId"].asString())
        assertEquals("Gone", entry["targetName"].asString(), "the name recorded for a family that no longer exists")
        assertTrue(fetch("/admin/audit?familyId=$family&action=family.purged")["entries"][0]["actor"].isNull)
    }

    @Test
    fun `filters list the people and actions of the log`() {
        val email = "listed-${UUID.randomUUID()}@example.com"
        val id = user(email, "Lia Listed")
        auditLog.record(email, "test.filters", "family", UUID.randomUUID().toString())

        val filters = fetch("/admin/audit/filters")
        assertTrue(filters["people"].strings("id").zip(filters["people"].strings("displayName")).contains(id.toString() to "Lia Listed"))
        assertTrue("test.filters" in (0 until filters["actions"].size()).map { filters["actions"].get(it).asString() })
    }

    @Test
    fun `invalid parameters answer 400`() {
        listOf("limit=0", "limit=101", "before=x", "userId=nobody", "familyId=1", "action=${"x".repeat(61)}").forEach { query ->
            mockMvc.get("/admin/audit?$query") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
                .andExpect { status { isBadRequest() } }
        }
    }
}
