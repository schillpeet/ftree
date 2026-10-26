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
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class FamilyVisibilityTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    @Autowired
    private lateinit var memberships: Memberships

    private lateinit var visible: UUID
    private lateinit var otherReal: UUID
    private lateinit var test: UUID

    @BeforeTest
    fun createFamilies() {
        visible = familyRepository.saveAndFlush(FamilyEntity(name = "Visible ${UUID.randomUUID()}")).id
        test = (familyService.create(CreateFamilyRequest("Visibility test ${UUID.randomUUID()}", 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id
        // Listed before every real family, the test family must not become visible as the first one used to.
        jdbc.update("UPDATE families SET position = (SELECT min(position) - 1 FROM families) WHERE id = ?", test)
        otherReal = familyRepository.saveAndFlush(FamilyEntity(name = "Other ${UUID.randomUUID()}")).id
        memberships.grant(visible, "visitor@example.com", Role.VISITOR, null)
        memberships.grant(visible, "editor@example.com", Role.EDITOR, null)
        // Only owners reach a test family; an editor there sees nothing of it.
        memberships.grant(test, "editor@example.com", Role.EDITOR, null)
    }

    private fun familyIds(email: String): List<String> {
        val json = mockMvc.get("/families") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = email)) }
            .andReturn().response.contentAsString
        return Regex(""""id":"([0-9a-f-]{36})"""").findAll(json).map { it.groupValues[1] }.toList()
    }

    @Test
    fun `non-admins list only the families of their memberships`() {
        listOf("visitor@example.com", "editor@example.com").forEach { email ->
            assertEquals(listOf(visible.toString()), familyIds(email), email)
        }
    }

    @Test
    fun `admins list every family, test families included`() {
        val ids = familyIds("admin@example.com")
        listOf(visible, otherReal, test).forEach { assertEquals(true, it.toString() in ids, "$it in $ids") }
    }

    @Test
    fun `non-admins get 404 for every other family`() {
        listOf(otherReal, test).forEach { family ->
            mockMvc.get("/families/$family/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "visitor@example.com")) }
                .andExpect { status { isNotFound() } }
            mockMvc.put("/families/$family") {
                header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "editor@example.com"))
                contentType = MediaType.APPLICATION_JSON
                content = """{"name":"Renamed ${UUID.randomUUID()}"}"""
            }.andExpect { status { isNotFound() } }
        }
        mockMvc.get("/families/$visible/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "visitor@example.com")) }
            .andExpect { status { isOk() } }
    }

    @Test
    fun `nobody sees a family without a membership, not even the first one`() {
        assertEquals(emptyList(), familyIds("someone@example.com"))
    }

    @Test
    fun `admins reach test families`() {
        mockMvc.get("/families/$test/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "admin@example.com")) }
            .andExpect { status { isOk() } }
    }
}
