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
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
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

// Two trees with their own people in the database: the father edits "schiller-<run>"; the friend, who may create trees,
// edits "design-<run>", where the viewer only looks, and owns the trees they create. The access file names only the
// admin; the trees it lists for the father do not apply.
@SpringBootTest
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class AccessFileModeTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberships: Memberships

    private lateinit var schiller: UUID
    private lateinit var design: UUID
    private lateinit var other: UUID
    private lateinit var test: UUID

    @BeforeTest
    fun createFamilies() {
        schiller = familyRepository.saveAndFlush(FamilyEntity(name = "Schiller $RUN", slug = "schiller-$RUN")).id
        design = familyRepository.saveAndFlush(FamilyEntity(name = "Design $RUN", slug = "design-$RUN")).id
        other = familyRepository.saveAndFlush(FamilyEntity(name = "Other $RUN")).id
        test = (familyService.create(CreateFamilyRequest("Test $RUN", 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id
        memberships.grant(schiller, "father@example.com", Role.EDITOR, null)
        memberships.grant(design, "friend@example.com", Role.EDITOR, null)
        memberships.grant(design, "viewer@example.com", Role.VISITOR, null)
        memberships.grantFlags("friend@example.com", admin = false, canCreateTrees = true, grantedBy = null)
    }

    private fun families(email: String): Map<String, String> {
        val json = mockMvc.get("/families") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }
            .andReturn().response.contentAsString
        return Regex(""""id":"([0-9a-f-]{36})".*?"role":"(\w+)"""").findAll(json).associate { it.groupValues[1] to it.groupValues[2] }
    }

    @Test
    fun `everyone lists exactly their trees with their role in each`() {
        assertEquals(mapOf(schiller.toString() to "editor"), families("father@example.com"))
        assertEquals(mapOf(design.toString() to "editor"), families("friend@example.com"))
        assertEquals(mapOf(design.toString() to "visitor"), families("viewer@example.com"))
        assertEquals(emptyMap(), families("stranger@example.com"))
        val admin = families("admin@example.com")
        listOf(schiller, design, other, test).forEach { assertEquals("admin", admin[it.toString()], "$it in $admin") }
    }

    @Test
    fun `families carry the permissions of the role in them`() {
        mockMvc.get("/families") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "friend@example.com")) }.andExpect {
            jsonPath("$[0].slug") { value("design-$RUN") }
            jsonPath("$[0].permissions.length()") { value(4) }
            jsonPath("$[0].permissions[1]") { value("member.edit") }
            jsonPath("$[0].permissions[3]") { value("family.export") }
        }
    }

    @Test
    fun `the role in the family of the request decides`() {
        rename(schiller, "father@example.com").andExpect { status { isOk() } }
        rename(design, "viewer@example.com").andExpect { status { isForbidden() } }
        rename(design, "friend@example.com").andExpect { status { isOk() } }
        mockMvc.get("/families/$design/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "viewer@example.com")) }
            .andExpect { status { isOk() } }
        mockMvc.post("/families/$design/members") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "viewer@example.com"))
            contentType = MediaType.APPLICATION_JSON
            content = "{}"
        }.andExpect { status { isForbidden() } }
        // Deleting stays with admins, and with owners in their trees.
        listOf(schiller to "father@example.com", design to "friend@example.com").forEach { (family, email) ->
            mockMvc.delete("/families/$family/members/${UUID.randomUUID()}") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }
                .andExpect { status { isForbidden() } }
            mockMvc.delete("/families/$family") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }
                .andExpect { status { isForbidden() } }
        }
    }

    @Test
    fun `trees someone is not listed for, and test families, do not exist for them`() {
        listOf(schiller, other, test).forEach { family ->
            mockMvc.get("/families/$family/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "friend@example.com")) }
                .andExpect { status { isNotFound() } }
            rename(family, "friend@example.com").andExpect { status { isNotFound() } }
        }
        mockMvc.get("/families/$schiller/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "stranger@example.com")) }
            .andExpect { status { isNotFound() } }
    }

    @Test
    fun `whoever creates a tree owns it, only they and admins see it, and they may delete it`() {
        listOf("father@example.com", "viewer@example.com").forEach { email -> create(email).andExpect { status { isForbidden() } } }
        val json = create("friend@example.com").andExpect {
            status { isCreated() }
            jsonPath("$.role") { value("owner") }
            jsonPath("$.permissions[5]") { value("family.delete") }
        }.andReturn().response.contentAsString
        val own = Regex(""""id":"([0-9a-f-]{36})"""").find(json)!!.groupValues[1]

        assertEquals("owner", families("friend@example.com")[own])
        assertEquals(null, families("father@example.com")[own])
        assertEquals("admin", families("admin@example.com")[own])
        mockMvc.delete("/families/$own") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "father@example.com")) }
            .andExpect { status { isNotFound() } }
        mockMvc.delete("/families/$own") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "friend@example.com")) }
            .andExpect { status { isNoContent() } }
    }

    @Test
    fun `whoever creates an empty tree owns it, and only they and admins see it`() {
        createEmpty("father@example.com").andExpect { status { isForbidden() } }
        val json = createEmpty("friend@example.com").andExpect {
            status { isCreated() }
            jsonPath("$.memberCount") { value(0) }
            jsonPath("$.role") { value("owner") }
        }.andReturn().response.contentAsString
        val own = Regex(""""id":"([0-9a-f-]{36})"""").find(json)!!.groupValues[1]

        assertEquals("owner", families("friend@example.com")[own])
        assertEquals(null, families("father@example.com")[own])
        assertEquals("admin", families("admin@example.com")[own])
    }

    @Test
    fun `me tells admins and tree creators apart and gives everyone the appearance`() {
        mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "father@example.com")) }.andExpect {
            jsonPath("$.admin") { value(false) }
            jsonPath("$.canCreateTrees") { value(false) }
            jsonPath("$.permissions.length()") { value(1) }
            jsonPath("$.permissions[0]") { value("tree.appearance") }
        }
        mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "friend@example.com")) }.andExpect {
            jsonPath("$.canCreateTrees") { value(true) }
            jsonPath("$.permissions.length()") { value(3) }
            jsonPath("$.permissions[1]") { value("family.create") }
        }
        mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
            .andExpect { jsonPath("$.admin") { value(true) } }
    }

    private fun create(email: String) = mockMvc.post("/families") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
        contentType = MediaType.APPLICATION_JSON
        content = """{"name":"Own ${UUID.randomUUID()}","totalUsers":1,"generationCount":1,"minChildren":0,"maxChildren":0}"""
    }

    private fun createEmpty(email: String) = mockMvc.post("/families/empty") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
        contentType = MediaType.APPLICATION_JSON
        content = """{"name":"Empty ${UUID.randomUUID()}"}"""
    }

    private fun rename(family: UUID, email: String) = mockMvc.put("/families/$family") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email))
        contentType = MediaType.APPLICATION_JSON
        content = """{"name":"Renamed ${UUID.randomUUID()}"}"""
    }

    companion object {
        private val RUN = UUID.randomUUID().toString().take(8)

        @JvmStatic
        @DynamicPropertySource
        fun accessFile(registry: DynamicPropertyRegistry) {
            val file = Files.createTempFile("access", ".yaml")
            file.toFile().deleteOnExit()
            file.writeText(
                """
                people:
                  - email: admin@example.com
                    admin: true
                  - email: father@example.com
                    trees:
                      schiller-$RUN: editor
                """.trimIndent(),
            )
            registry.add("app.access.file") { file.toString() }
        }
    }
}
