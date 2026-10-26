package com.github.bff.admin

import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.auth.Role
import com.github.bff.live.Presence
import com.github.bff.live.PresenceRegistry
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class AdminOverviewTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var registry: PresenceRegistry

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val json = JsonMapper()

    private fun fetch(path: String): JsonNode =
        json.readTree(
            mockMvc.get(path) { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
                .andExpect { status { isOk() } }.andReturn().response.contentAsString,
        )

    private val joined = mutableListOf<Presence>()
    private val joinedAt = Instant.parse("2026-10-26T10:00:00Z")

    // Puts the tabs into the shared registry, as of joinedAt; they leave again after each test.
    private fun present(vararg tabs: Presence) {
        registry.clock = Clock.fixed(joinedAt, ZoneOffset.UTC)
        tabs.forEach { registry.update(it.familyId, it.clientId, it.email, it.admin, it.viewing, it.editing, it.idle) }
        joined += tabs
    }

    @AfterTest
    fun emptyRegistry() {
        joined.forEach { registry.leave(it.familyId, it.clientId, it.email) }
        registry.clock = Clock.systemUTC()
    }

    private fun user(email: String, signedIn: Boolean, displayName: String? = null, admin: Boolean = false) {
        jdbc.update(
            "INSERT INTO users (email, first_seen, last_seen, display_name, admin) VALUES (?, ?, ?, ?, ?)",
            email, if (signedIn) java.sql.Timestamp.from(Instant.now()) else null, if (signedIn) java.sql.Timestamp.from(Instant.now()) else null,
            displayName, admin,
        )
    }

    @Test
    fun `the overview counts what was added`() {
        val before = fetch("/admin/overview")
        val family = familyRepository.saveAndFlush(FamilyEntity(name = "Overview ${UUID.randomUUID()}"))
        jdbc.update("INSERT INTO members (id, family_id, first_name, last_name) VALUES (gen_random_uuid(), ?, 'A', 'B')", family.id)
        jdbc.update("INSERT INTO members (id, family_id, first_name, last_name) VALUES (gen_random_uuid(), ?, 'C', 'D')", family.id)
        jdbc.update("INSERT INTO family_photos (family_id, content_type, data, updated_at) VALUES (?, 'image/png', ?, now())", family.id, ByteArray(10))
        user("seen-${UUID.randomUUID()}@example.com", signedIn = true)
        user("invited-${UUID.randomUUID()}@example.com", signedIn = false, admin = true)
        present(tab(family.id, "admin@example.com"), tab(family.id, "admin@example.com", "second"), tab(family.id, "other@example.com"))

        val after = fetch("/admin/overview")
        assertEquals(1, after["families"].asInt() - before["families"].asInt())
        assertEquals(2, after["members"].asInt() - before["members"].asInt())
        assertEquals(2, after["users"]["total"].asInt() - before["users"]["total"].asInt())
        assertEquals(1, after["users"]["signedIn"].asInt() - before["users"]["signedIn"].asInt())
        assertEquals(1, after["users"]["invited"].asInt() - before["users"]["invited"].asInt())
        assertEquals(1, after["photos"]["count"].asInt() - before["photos"]["count"].asInt())
        assertEquals(10, after["photos"]["bytes"].asLong() - before["photos"]["bytes"].asLong())
        assertEquals(2, after["online"].asInt(), "two people with three tabs")
        assertEquals(50, after["seats"]["limit"].asInt())
        // The new admin has access; the other new user has none.
        assertEquals(1, after["seats"]["used"].asInt() - before["seats"]["used"].asInt())
        assertNull(after["lastBackupAt"].takeUnless { it.isNull })
    }

    @Test
    fun `seats count every person with access once`() {
        val family = familyRepository.saveAndFlush(FamilyEntity(name = "Seats ${UUID.randomUUID()}"))
        val before = fetch("/admin/overview")["seats"]["used"].asInt()
        val email = "member-${UUID.randomUUID()}@example.com"
        user(email, signedIn = true, admin = true)
        jdbc.update("INSERT INTO family_memberships (family_id, email, role) VALUES (?, ?, ?)", family.id, email, Role.EDITOR.name.lowercase())
        assertEquals(before + 1, fetch("/admin/overview")["seats"]["used"].asInt())
    }

    @Test
    fun `presence lists every tab with its tree and a name`() {
        val family = familyRepository.saveAndFlush(FamilyEntity(name = "Presence ${UUID.randomUUID()}"))
        val named = "named-${UUID.randomUUID()}@example.com"
        user(named, signedIn = true, displayName = "Nina Named")
        val member = UUID.randomUUID()
        present(
            tab(family.id, named, viewing = member, editing = member, idle = true),
            tab(family.id, "nobody@example.com", admin = true),
            tab(UUID.randomUUID(), "gone@example.com"),
        )

        val tabs = fetch("/admin/presence")
        assertEquals(2, tabs.size(), "the tab of the unknown family is left out")
        val first = tabs[0]
        assertEquals("Nina Named", first["displayName"].asString())
        assertEquals(named, first["email"].asString())
        assertEquals(family.id.toString(), first["familyId"].asString())
        assertEquals(family.slug, first["familySlug"].asString())
        assertEquals(family.name, first["familyName"].asString())
        assertEquals(member.toString(), first["viewing"].asString())
        assertEquals(member.toString(), first["editing"].asString())
        assertEquals(true, first["idle"].asBoolean())
        assertEquals(joinedAt, Instant.parse(first["since"].asString()))
        assertEquals(false, first["userId"].isNull)
        val second = tabs[1]
        assertEquals("nobody", second["displayName"].asString(), "without a row or a name, the email's local part")
        assertEquals(true, second["userId"].isNull)
        assertEquals(true, second["admin"].asBoolean())
    }

    @Test
    fun `presence is empty when nobody is present`() {
        present()
        assertEquals(0, fetch("/admin/presence").size())
    }

    @Test
    fun `families list test families, members, and roles`() {
        val normal = familyRepository.saveAndFlush(FamilyEntity(name = "Normal ${UUID.randomUUID()}", createdBy = "creator@example.com"))
        val test = familyRepository.saveAndFlush(
            FamilyEntity(name = "Test ${UUID.randomUUID()}", totalUsers = 1, generationCount = 1, minChildren = 0, maxChildren = 0),
        )
        jdbc.update("INSERT INTO members (id, family_id, first_name, last_name) VALUES (gen_random_uuid(), ?, 'A', 'B')", normal.id)
        listOf("own" to Role.OWNER, "ed1" to Role.EDITOR, "ed2" to Role.EDITOR, "vis" to Role.VISITOR).forEach { (name, role) ->
            val email = "$name-${UUID.randomUUID()}@example.com"
            user(email, signedIn = false)
            jdbc.update("INSERT INTO family_memberships (family_id, email, role) VALUES (?, ?, ?)", normal.id, email, role.name.lowercase())
        }

        val families = fetch("/admin/families").associateBy { it["id"].asString() }
        val n = families.getValue(normal.id.toString())
        assertEquals(normal.name, n["name"].asString())
        assertEquals(normal.slug, n["slug"].asString())
        assertEquals("creator@example.com", n["createdBy"].asString())
        assertEquals(false, n["test"].asBoolean())
        assertEquals(1, n["memberCount"].asInt())
        assertEquals(listOf(1, 2, 1), listOf("owner", "editor", "visitor").map { n["memberships"][it].asInt() })
        val t = families.getValue(test.id.toString())
        assertEquals(true, t["test"].asBoolean())
        assertEquals(true, t["createdBy"].isNull)
        assertEquals(0, t["memberCount"].asInt())
        assertEquals(0, t["memberships"]["owner"].asInt())
    }

    @Test
    fun `trashed families are neither listed nor counted`() {
        val family = familyRepository.saveAndFlush(FamilyEntity(name = "Trashed ${UUID.randomUUID()}"))
        val member = UUID.randomUUID()
        jdbc.update("INSERT INTO members (id, family_id, first_name, last_name) VALUES (?, ?, 'A', 'B')", member, family.id)
        jdbc.update("INSERT INTO family_photos (family_id, content_type, data, updated_at) VALUES (?, 'image/png', ?, now())", family.id, ByteArray(10))
        jdbc.update("INSERT INTO member_photos (member_id, content_type, data, updated_at) VALUES (?, 'image/png', ?, now())", member, ByteArray(20))
        val before = fetch("/admin/overview")

        mockMvc.delete("/families/${family.id}") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
            .andExpect { status { isNoContent() } }

        val after = fetch("/admin/overview")
        assertEquals(before["families"].asInt() - 1, after["families"].asInt())
        assertEquals(before["members"].asInt() - 1, after["members"].asInt())
        assertEquals(before["photos"]["count"].asInt() - 2, after["photos"]["count"].asInt())
        assertEquals(before["photos"]["bytes"].asLong() - 30, after["photos"]["bytes"].asLong())
        assertFalse(fetch("/admin/families").any { it["id"].asString() == family.id.toString() })
        assertTrue(fetch("/admin/trash").any { it["id"].asString() == family.id.toString() })
    }

    @Test
    fun `only admins may read the admin endpoints`() {
        listOf("/admin/overview", "/admin/presence", "/admin/families").forEach { path ->
            mockMvc.get(path) { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "editor@example.com")) }.andExpect { status { isForbidden() } }
            mockMvc.get(path).andExpect { status { isUnauthorized() } }
        }
    }

    private fun tab(
        family: UUID,
        email: String,
        clientId: String = "tab",
        admin: Boolean = false,
        viewing: UUID? = null,
        editing: UUID? = null,
        idle: Boolean = false,
    ) = Presence(family, clientId, email, admin, viewing, editing, idle, since = joinedAt, seen = joinedAt)
}
