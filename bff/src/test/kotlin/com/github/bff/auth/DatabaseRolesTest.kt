package com.github.bff.auth

import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.member.FamilyCreationResult
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import com.github.bff.member.FamilyService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Files
import java.util.UUID
import kotlin.io.path.writeText
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

// Rights granted in the database apply on the next request; of the access file only the admins still apply.
@SpringBootTest
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class DatabaseRolesTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private lateinit var tree: UUID
    private lateinit var other: UUID
    private lateinit var test: UUID

    @BeforeTest
    fun createFamilies() {
        tree = familyRepository.saveAndFlush(FamilyEntity(name = "Tree $RUN", slug = "tree-$RUN")).id
        other = familyRepository.saveAndFlush(FamilyEntity(name = "Other $RUN")).id
        test = (familyService.create(CreateFamilyRequest("Test $RUN", 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id
    }

    private fun families(email: String): Map<String, String> {
        val json = mockMvc.get("/families") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }
            .andReturn().response.contentAsString
        return Regex(""""id":"([0-9a-f-]{36})".*?"role":"(\w+)"""").findAll(json).associate { it.groupValues[1] to it.groupValues[2] }
    }

    private fun rename(family: UUID, email: String) = mockMvc.put("/families/$family") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
        contentType = MediaType.APPLICATION_JSON
        content = """{"name":"Renamed ${UUID.randomUUID()}"}"""
    }

    @Test
    fun `a membership gives its role in that tree only`() {
        memberships.grant(tree, EDITOR.uppercase(), Role.EDITOR, ADMIN)
        memberships.grant(other, VISITOR, Role.VISITOR, ADMIN)

        assertEquals(mapOf(tree.toString() to "editor"), families(EDITOR))
        assertEquals(mapOf(other.toString() to "visitor"), families(VISITOR))
        rename(tree, EDITOR).andExpect { status { isOk() } }
        rename(other, VISITOR).andExpect { status { isForbidden() } }
        rename(other, EDITOR).andExpect { status { isNotFound() } }
    }

    @Test
    fun `the trees of the access file no longer apply, only the database does`() {
        assertEquals(emptyMap(), families(LISTED))

        memberships.grant(tree, LISTED, Role.VISITOR, ADMIN)
        assertEquals(mapOf(tree.toString() to "visitor"), families(LISTED))
    }

    @Test
    fun `only an owner membership reaches a test family`() {
        memberships.grant(test, EDITOR, Role.EDITOR, ADMIN)
        memberships.grant(test, BUILDER, Role.OWNER, ADMIN)

        assertEquals(null, families(EDITOR)[test.toString()])
        assertEquals("owner", families(BUILDER)[test.toString()])
    }

    @Test
    fun `can_create_trees in users is a global right, admin there is not`() {
        memberships.grantFlags(VISITOR, admin = true, canCreateTrees = false, grantedBy = ADMIN)
        memberships.grantFlags(BUILDER, admin = false, canCreateTrees = true, grantedBy = ADMIN)

        // Admins come only from the access file, so users.admin alone gives nothing.
        assertEquals(null, families(VISITOR)[test.toString()])
        mockMvc.get("/users") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = VISITOR)) }.andExpect { status { isForbidden() } }
        mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = BUILDER)) }.andExpect {
            jsonPath("$.admin") { value(false) }
            jsonPath("$.canCreateTrees") { value(true) }
        }
    }

    @Test
    fun `the creator of a tree becomes its owner, written to the audit log`() {
        memberships.grantFlags(BUILDER, admin = false, canCreateTrees = true, grantedBy = ADMIN)

        val json = mockMvc.post("/families/empty") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = BUILDER))
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"Built ${UUID.randomUUID()}"}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.role") { value("owner") }
            jsonPath("$.permissions[?(@ == 'family.share')]") { exists() }
        }.andReturn().response.contentAsString
        val own = Regex(""""id":"([0-9a-f-]{36})"""").find(json)!!.groupValues[1]

        assertEquals(
            "owner",
            jdbc.queryForObject("SELECT role FROM family_memberships WHERE family_id = ?::uuid AND email = ?", String::class.java, own, BUILDER),
        )
        assertEquals(
            1,
            jdbc.queryForObject(
                "SELECT count(*) FROM audit_log WHERE action = 'membership.granted' AND target_id = ? AND actor = ? AND details ->> 'role' = 'owner'",
                Int::class.java, own, BUILDER,
            ),
        )
    }

    @Test
    fun `the access file keeps its admins whatever the database says`() {
        jdbc.update("INSERT INTO users (email, admin) VALUES (?, false) ON CONFLICT (email) DO UPDATE SET admin = false", ADMIN)
        assertEquals("admin", families(ADMIN)[test.toString()])
    }

    @Test
    fun `users lists the people with rights in the database`() {
        memberships.grant(tree, VISITOR, Role.VISITOR, ADMIN)

        val json = mockMvc.get("/users") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = ADMIN)) }
            .andExpect { status { isOk() } }
            .andReturn().response.contentAsString
        val users = Regex("""\{"email":"([^"]+)","listed":(\w+)""").findAll(json).map { it.groupValues[1] to it.groupValues[2] }.toList()

        assertEquals(ADMIN to "true", users.first())
        assertEquals("true", users.toMap()[VISITOR])
        assertNotEquals("true", users.toMap()[LISTED])
    }

    companion object {
        private val RUN = UUID.randomUUID().toString().take(8)
        private val ADMIN = "db-admin-$RUN@example.com"
        private val LISTED = "db-listed-$RUN@example.com"
        private val EDITOR = "db-editor-$RUN@example.com"
        private val VISITOR = "db-visitor-$RUN@example.com"
        private val BUILDER = "db-builder-$RUN@example.com"

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
                  - email: $LISTED
                    trees:
                      tree-$RUN: editor
                """.trimIndent(),
            )
            registry.add("app.access.file") { file.toString() }
        }
    }
}
