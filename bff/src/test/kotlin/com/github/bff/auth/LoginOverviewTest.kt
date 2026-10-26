package com.github.bff.auth

import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Files
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import kotlin.io.path.writeText
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class LoginOverviewTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var loginRecorder: LoginRecorder

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    private val start = Instant.parse("2026-10-01T08:00:00Z")

    @AfterTest
    fun resetClock() {
        loginRecorder.clock = Clock.systemUTC()
    }

    private fun at(instant: Instant) {
        loginRecorder.clock = Clock.fixed(instant, ZoneOffset.UTC)
    }

    private fun signIn(email: String) =
        mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }.andExpect { status { isOk() } }

    private fun seen(email: String): Pair<Instant, Instant>? =
        jdbc.query("SELECT first_seen, last_seen FROM users WHERE email = ?", { rs, _ ->
            rs.getObject(1, OffsetDateTime::class.java).toInstant() to rs.getObject(2, OffsetDateTime::class.java).toInstant()
        }, email).singleOrNull()

    @Test
    fun `a sign-in is written at most once per interval`() {
        val email = "visitor-${UUID.randomUUID()}@example.com"
        at(start)
        signIn(email.uppercase())
        assertEquals(start to start, seen(email))

        at(start + LoginRecorder.INTERVAL - Duration.ofSeconds(1))
        signIn(email)
        assertEquals(start to start, seen(email))

        val later = start + LoginRecorder.INTERVAL
        at(later)
        signIn(email)
        assertEquals(start to later, seen(email))
    }

    @Test
    fun `admins see the listed people with their sign-ins, then everyone else who signed in`() {
        val stranger = "stranger-${UUID.randomUUID()}@example.com"
        val family = familyRepository.saveAndFlush(FamilyEntity(name = "Logins $RUN")).id
        memberships.grant(family, NEVER.uppercase(), Role.VISITOR, ADMIN)
        memberships.grant(family, SIGNED_IN, Role.EDITOR, ADMIN)
        at(start)
        signIn(SIGNED_IN)
        at(start + Duration.ofMinutes(1))
        signIn(stranger)

        val json = mockMvc.get("/users") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = ADMIN)) }
            .andExpect { status { isOk() } }
            .andReturn().response.contentAsString
        val users = Regex("""\{"email":"([^"]+)","listed":(\w+),"firstSeen":("[^"]+"|null),"lastSeen":("[^"]+"|null)}""")
            .findAll(json).associate { it.groupValues[1] to it.groupValues.drop(2) }

        // The bootstrap admin first, then everyone with a right in the database by email, then the rest.
        val order = users.keys.toList()
        assertEquals(ADMIN, order.first())
        assertTrue(order.indexOf(NEVER) < order.indexOf(SIGNED_IN) && order.indexOf(SIGNED_IN) < order.indexOf(stranger), "$order")
        assertEquals(listOf("true", "null", "null"), users[NEVER])
        assertEquals("true", users.getValue(SIGNED_IN)[0])
        assertEquals("false", users.getValue(stranger)[0])
        assertEquals(Instant.parse(users.getValue(stranger)[2].trim('"')), start + Duration.ofMinutes(1))
    }

    @Test
    fun `only admins see the sign-ins`() {
        mockMvc.get("/users") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = SIGNED_IN)) }
            .andExpect { status { isForbidden() } }
    }

    companion object {
        private val RUN = UUID.randomUUID().toString().take(8)
        private val ADMIN = "admin-$RUN@example.com"
        private val NEVER = "never-$RUN@example.com"
        private val SIGNED_IN = "signed-in-$RUN@example.com"

        @JvmStatic
        @DynamicPropertySource
        fun accessFile(registry: DynamicPropertyRegistry) {
            val file = Files.createTempFile("access", ".yaml")
            file.toFile().deleteOnExit()
            file.writeText(
                """
                people:
                  - email: $ADMIN
                    admin: true
                """.trimIndent(),
            )
            registry.add("app.access.file") { file.toString() }
        }
    }
}
