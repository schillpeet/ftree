package com.github.bff.admin

import com.github.bff.auth.AuditLog
import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
import com.github.bff.auth.CloudflareTestTokens.token
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.web.servlet.MockHttpServletRequestDsl
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
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

    private val admin by lazy { token(email = "admin@example.com") }

    // Sends the body as the admin and answers the response as JSON.
    private fun send(method: String, path: String, body: String? = null): JsonNode {
        val request: MockHttpServletRequestDsl.() -> Unit = {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            body?.let {
                contentType = MediaType.APPLICATION_JSON
                content = it
            }
        }
        val result = when (method) {
            "POST" -> mockMvc.post(path, dsl = request)
            "PUT" -> mockMvc.put(path, dsl = request)
            else -> mockMvc.delete(path, dsl = request)
        }
        val text = result.andExpect { status { is2xxSuccessful() } }.andReturn().response.contentAsString
        return if (text.isEmpty()) json.nullNode() else json.readTree(text)
    }

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
    fun `tree changes are logged in the tree category`() {
        val family = send("POST", "/families/empty", """{"name":"Audit tree ${UUID.randomUUID()}"}""")["id"].asString()
        val renamed = "Audit renamed ${UUID.randomUUID()}"
        send("PUT", "/families/$family", """{"name":"$renamed"}""")

        val entries = fetch("/admin/audit?familyId=$family")["entries"]
        assertEquals(listOf("family.renamed", "family.created", "membership.granted"), entries.strings("action"))
        assertEquals(listOf("tree", "tree", "access"), entries.strings("category"))
        assertEquals(renamed, entries[0]["details"]["name"].asString())
        assertEquals("admin@example.com", entries[0]["actor"].asString())
    }

    @Test
    fun `person changes name only the person and the changed fields, never their values`() {
        val family = send("POST", "/families/empty", """{"name":"Audit content ${UUID.randomUUID()}"}""")["id"].asString()
        val member = send("POST", "/families/$family/members", """{"firstName":"Secret","lastName":"Person"}""")["id"].asString()
        send("PUT", "/families/$family/members/$member", """{"firstName":"Hidden","lastName":"Person","birthPlace":"Nowhere"}""")
        send("PUT", "/families/$family/members/$member", """{"firstName":"Hidden","lastName":"Person","birthPlace":"Nowhere"}""")
        send("DELETE", "/families/$family/members/$member")

        val entries = fetch("/admin/audit?familyId=$family&category=content")["entries"]
        assertEquals(listOf("member.deleted", "member.updated", "member.created"), entries.strings("action"), "an update without changes is not logged")
        assertEquals(listOf(member, member, member), entries.strings("details", "memberId"))
        assertEquals("firstName,birthPlace", entries[1]["details"]["fields"].asString())
        val text = entries.toString()
        listOf("Secret", "Hidden", "Nowhere").forEach { assertFalse(it in text, "$it is a value") }
    }

    @Test
    fun `entries keep their category and actor id and filter by category and time`() {
        val email = "timed-${UUID.randomUUID()}@example.com"
        val id = user(email, null)
        val action = "test.timed.${UUID.randomUUID()}"
        auditLog.record(email, action, "family", UUID.randomUUID().toString(), mapOf("n" to "old"))
        auditLog.record(email, action, "family", UUID.randomUUID().toString(), mapOf("n" to "new"))
        jdbc.update("UPDATE audit_log SET at = '2020-01-01T00:00:00Z' WHERE action = ? AND details->>'n' = 'old'", action)

        assertEquals(id, jdbc.queryForObject("SELECT DISTINCT actor_id FROM audit_log WHERE action = ?", UUID::class.java, action))
        fun ns(query: String) = fetch("/admin/audit?action=$action&$query")["entries"].strings("details", "n")
        assertEquals(listOf("new", "old"), ns("category=system"))
        assertEquals(emptyList(), ns("category=content"))
        assertEquals(listOf("new"), ns("from=2021-01-01T00:00:00Z"))
        assertEquals(listOf("old"), ns("to=2021-01-01T00:00:00Z"))
        assertEquals(listOf("old"), ns("from=2020-01-01T00:00:00Z&to=2020-01-01T00:00:01Z"), "from is inclusive")
    }

    @Test
    fun `actions map to categories`() {
        mapOf(
            "membership.granted" to "access",
            "user.admin.revoked" to "access",
            "user.can-create-trees.granted" to "access",
            "user.sessions.revoked" to "access",
            "family.ownership.transferred" to "access",
            "family.renamed" to "tree",
            "family.purged" to "tree",
            "member.updated" to "content",
            "user.deleted" to "admin",
            "user.display-name.changed" to "admin",
            "access_file.imported" to "system",
        ).forEach { (action, category) -> assertEquals(category, AuditLog.categoryOf(action), action) }
    }

    @Test
    fun `invalid parameters answer 400`() {
        listOf(
            "limit=0", "limit=101", "before=x", "userId=nobody", "familyId=1", "action=${"x".repeat(61)}", "category=other", "from=yesterday",
        ).forEach { query ->
            mockMvc.get("/admin/audit?$query") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
                .andExpect { status { isBadRequest() } }
        }
    }
}
