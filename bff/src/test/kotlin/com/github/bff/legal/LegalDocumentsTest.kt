package com.github.bff.legal

import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
import com.github.bff.auth.CloudflareTestTokens.token
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.security.MessageDigest
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The rows the tests add stay inside their transaction, so the shared database keeps only the published versions.
@SpringBootTest(properties = ["app.roles.admins=admin@example.com", "test.legal.gate=on"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class LegalDocumentsTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val json = JsonMapper()
    private val person = "legal-${UUID.randomUUID().toString().take(8)}@example.com"

    private fun me(email: String = person): JsonNode =
        json.readTree(mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }.andExpect { status { isOk() } }.andReturn().response.contentAsString)

    private fun families(email: String = person) =
        mockMvc.get("/families") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }.andReturn().response

    private fun accept(vararg documents: Pair<String, Int>, language: String = "de", email: String = person) =
        mockMvc.post("/me/legal-acceptances") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
            contentType = MediaType.APPLICATION_JSON
            content = """{"documents":[${documents.joinToString { (kind, version) -> """{"kind":"$kind","version":$version}""" }}],"language":"$language"}"""
        }.andReturn().response

    private fun current(kind: String) =
        jdbc.queryForObject("SELECT max(version) FROM legal_documents WHERE kind = ? AND effective_at <= now()", Int::class.java, kind)!!

    private fun acceptCurrent(email: String = person) =
        assertEquals(200, accept("terms" to current("terms"), "privacy" to current("privacy"), email = email).status)

    private fun publish(kind: String, version: Int, effectiveAt: OffsetDateTime = OffsetDateTime.now().minusMinutes(1), requiresAction: Boolean = true) {
        jdbc.update(
            "INSERT INTO legal_documents (kind, version, effective_at, requires_action, body_de, body_en, change_summary_de, change_summary_en, content_sha256) " +
                "VALUES (?, ?, ?, ?, 'neu', 'new', 'Neu', 'New', 'x')",
            kind, version, effectiveAt, requiresAction,
        )
    }

    private fun JsonNode.strings(key: String): Set<String> = (0 until size()).map { get(it)[key].asString() as String }.toSet()

    private fun JsonNode.kinds() = strings("kind")

    @Test
    fun `someone new has both documents open and nothing else works until they accept`() {
        val pending = me()["pendingLegal"]
        assertEquals(setOf("terms", "privacy"), pending.kinds())
        assertTrue(pending.all { it["previousVersion"].isNull })

        val blocked = families()
        assertEquals(403, blocked.status)
        assertEquals("LEGAL_ACCEPTANCE_REQUIRED", json.readTree(blocked.contentAsString)["code"].asString())

        // The terms alone are not enough, the privacy notice has to be acknowledged too.
        assertEquals(200, accept("terms" to current("terms")).status)
        assertEquals(setOf("privacy"), me()["pendingLegal"].kinds())
        assertEquals(403, families().status)

        val answer = accept("privacy" to current("privacy"), language = "en")
        assertEquals(200, answer.status)
        assertEquals(0, json.readTree(answer.contentAsString)["pendingLegal"].size())
        assertEquals(200, families().status)
    }

    @Test
    fun `accepting is recorded once, with the language, in the audit log and without any trace of the connection`() {
        acceptCurrent()
        acceptCurrent()
        assertEquals(
            2,
            jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action = 'legal.accepted' AND actor = ?", Int::class.java, person),
        )
        assertEquals(
            listOf("access"),
            jdbc.queryForList("SELECT DISTINCT category FROM audit_log WHERE action = 'legal.accepted' AND actor = ?", String::class.java, person),
        )
        val list = json.readTree(mockMvc.get("/me/legal-acceptances") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = person)) }.andReturn().response.contentAsString)
        assertEquals(setOf("terms", "privacy"), list.kinds())
        assertEquals(setOf("de"), list.strings("language"))
        assertEquals(
            setOf("id", "user_id", "document_id", "accepted_at", "language"),
            jdbc.queryForList("SELECT column_name FROM information_schema.columns WHERE table_name = 'legal_acceptances'", String::class.java).toSet(),
        )
    }

    @Test
    fun `a new version asks again, with what changed and what the person accepted before`() {
        acceptCurrent()
        assertEquals(200, families().status)
        val next = current("terms") + 1000
        publish("terms", next)

        assertEquals(403, families().status)
        val open = me()["pendingLegal"].single()
        assertEquals(next, open["version"].asInt())
        assertEquals(current("terms") - 1000, open["previousVersion"].asInt())
        assertEquals("Neu", open["changeSummaryDe"].asString())

        assertEquals(200, accept("terms" to next).status)
        assertEquals(200, families().status)
    }

    @Test
    fun `a future version only announces, and blocks once it applies`() {
        acceptCurrent()
        val next = current("terms") + 1000
        publish("terms", next, OffsetDateTime.now().plusDays(14))

        assertEquals(200, families().status)
        val me = me()
        assertEquals(0, me["pendingLegal"].size())
        assertEquals(next, me["announcedLegal"].single()["version"].asInt())
        // It cannot be accepted ahead of time.
        assertEquals(400, accept("terms" to next).status)

        jdbc.update("UPDATE legal_documents SET effective_at = now() - interval '1 minute' WHERE kind = 'terms' AND version = ?", next)
        assertEquals(403, families().status)
        assertEquals(0, me()["announcedLegal"].size())
    }

    @Test
    fun `a correction asks nobody who accepted, and someone new accepts the corrected text`() {
        acceptCurrent()
        val next = current("terms") + 1000
        publish("terms", next, requiresAction = false)
        assertEquals(200, families().status)

        val newcomer = "new-$person"
        assertEquals(next, me(newcomer)["pendingLegal"].first { it["kind"].asString() == "terms" }["version"].asInt())
        // A version that is not open, like the one before the correction, cannot be accepted.
        assertEquals(400, accept("terms" to next - 1000, email = newcomer).status)
        assertEquals(200, accept("terms" to next, "privacy" to current("privacy"), email = newcomer).status)
        assertEquals(200, families(newcomer).status)
    }

    @Test
    fun `an admin is held up like everyone else and sees what a person accepted`() {
        assertEquals(403, families("admin@example.com").status)
        jdbc.update("DELETE FROM legal_acceptances WHERE user_id = (SELECT id FROM users WHERE email = 'admin@example.com')")
        acceptCurrent("admin@example.com")
        acceptCurrent()

        val id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID::class.java, person)
        val list = json.readTree(
            mockMvc.get("/admin/users/$id/legal-acceptances") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
                .andExpect { status { isOk() } }.andReturn().response.contentAsString,
        )
        assertEquals(setOf("terms", "privacy"), list.kinds())
        mockMvc.get("/admin/users/${UUID.randomUUID()}/legal-acceptances") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
            .andExpect { status { isNotFound() } }

        jdbc.update("DELETE FROM users WHERE id = ?", id)
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM legal_acceptances WHERE user_id = ?", Int::class.java, id))
    }

    @Test
    fun `the texts need no sign-in and older versions stay readable`() {
        val latest = json.readTree(mockMvc.get("/legal/terms").andExpect { status { isOk() } }.andReturn().response.contentAsString)
        val version = latest["version"].asInt()
        assertEquals(current("terms"), version)
        assertTrue(latest["bodyDe"].asString().contains("{{operator.name}}"))

        publish("terms", version + 1000)
        publish("terms", version + 2000, OffsetDateTime.now().plusDays(14))
        val now = json.readTree(mockMvc.get("/legal/terms").andReturn().response.contentAsString)
        assertEquals(version + 1000, now["version"].asInt())
        assertEquals(listOf(version + 2000, version + 1000), now["versions"].take(2).map { it["version"].asInt() })
        assertEquals(version, json.readTree(mockMvc.get("/legal/terms?version=$version").andReturn().response.contentAsString)["version"].asInt())
        assertEquals(version + 2000, json.readTree(mockMvc.get("/legal/terms?version=${version + 2000}").andReturn().response.contentAsString)["version"].asInt())

        mockMvc.get("/legal/terms?version=99999999").andExpect { status { isNotFound() } }
        mockMvc.get("/legal/terms?version=0").andExpect { status { isBadRequest() } }
        mockMvc.get("/legal/imprint").andExpect { status { isBadRequest() } }
    }

    @Test
    fun `the published checksums match their German texts, which keep their placeholders`() {
        jdbc.query("SELECT body_de, body_en, content_sha256 FROM legal_documents") { rs, _ ->
            val hash = MessageDigest.getInstance("SHA-256").digest(rs.getString(1).toByteArray()).joinToString("") { "%02x".format(it) }
            assertEquals(hash, rs.getString(3))
            assertTrue(rs.getString(1).contains("{{operator.email}}"))
            assertTrue(rs.getString(2).contains("{{operator.email}}"))
        }
    }

    private fun row(version: Int, accepted: Boolean = false, requiresAction: Boolean = true, kind: String = "terms", minutesAgo: Long = 10) = LegalRow(
        UUID.randomUUID(), kind, version, OffsetDateTime.ofInstant(NOW.minusSeconds(minutesAgo * 60), ZoneOffset.UTC), requiresAction, null, null, accepted,
    )

    @Test
    fun `what is open follows the newest version in force that needs action`() {
        fun open(vararg rows: LegalRow) = pendingOf(rows.toList(), NOW).map { it.kind to it.version }

        assertEquals(listOf("terms" to 1), open(row(1)))
        assertEquals(emptyList(), open(row(1, accepted = true)))
        assertEquals(listOf("terms" to 2), open(row(1, accepted = true), row(2)))
        assertEquals(emptyList(), open(row(1, accepted = true), row(2, requiresAction = false)))
        assertEquals(listOf("terms" to 2), open(row(1), row(2, requiresAction = false)))
        assertEquals(emptyList(), open(row(1, accepted = true), row(2, minutesAgo = -5)))
        assertEquals(emptyList(), open(row(1, requiresAction = false)))
        assertEquals(listOf("privacy" to 1), open(row(1, accepted = true), row(1, kind = "privacy")))
        assertEquals(listOf(2), announcedOf(listOf(row(1), row(2, minutesAgo = -5)), NOW).map { it.version })
    }

    private companion object {
        val NOW: Instant = Instant.parse("2027-01-01T00:00:00Z")
    }
}
