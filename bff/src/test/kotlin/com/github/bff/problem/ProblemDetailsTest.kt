package com.github.bff.problem

import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.generated.model.ProblemCode
import com.github.bff.member.FamilyRepository
import org.hamcrest.Matchers.containsString
import org.hamcrest.Matchers.not
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MockMvcResultMatchersDsl
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest(properties = ["app.roles.admins=admin@example.com", "app.roles.editors=editor@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class ProblemDetailsTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    private val admin by lazy { token(email = "admin@example.com") }

    private fun ResultActionsDsl.problem(code: ProblemCode, status: Int, path: String, more: MockMvcResultMatchersDsl.() -> Unit = {}) =
        andExpect {
            status { isEqualTo(status) }
            content { contentType(MediaType.APPLICATION_PROBLEM_JSON) }
            jsonPath("$.type") { value("urn:ftree:problem:" + code.name.lowercase().replace('_', '-')) }
            jsonPath("$.title") { exists() }
            jsonPath("$.status") { value(status) }
            jsonPath("$.detail") { exists() }
            jsonPath("$.instance") { value(path) }
            jsonPath("$.code") { value(code.value) }
            jsonPath("$.trace") { doesNotExist() }
            jsonPath("$.exception") { doesNotExist() }
            more()
        }

    private fun emptyFamily(name: String) = mockMvc.post("/families/empty") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
        contentType = MediaType.APPLICATION_JSON
        content = """{"name":"$name"}"""
    }

    private fun createdFamily(): UUID {
        val name = "Problem ${UUID.randomUUID()}"
        emptyFamily(name).andExpect { status { isCreated() } }
        return familyRepository.findAll().single { it.name == name }.id
    }

    @Test
    fun `a request without a sign-in is unauthenticated`() {
        mockMvc.get("/families").problem(ProblemCode.UNAUTHENTICATED, 401, "/families")
    }

    @Test
    fun `an invalid token is unauthenticated without naming why`() {
        mockMvc.get("/me") { header(CLOUDFLARE_ACCESS_JWT_HEADER, "not-a-jwt") }
            .problem(ProblemCode.UNAUTHENTICATED, 401, "/me") {
                content { string(not(containsString("Jwt"))) }
            }
    }

    @Test
    fun `a missing permission is forbidden`() {
        mockMvc.post("/families/empty") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "visitor@example.com"))
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"Forbidden"}"""
        }.problem(ProblemCode.FORBIDDEN, 403, "/families/empty")
    }

    @Test
    fun `a family the user may not see is not found`() {
        // The visitor sees only the first family, so the second one created here stays hidden.
        createdFamily()
        val hidden = createdFamily()
        mockMvc.get("/families/$hidden/members") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "visitor@example.com")) }
            .problem(ProblemCode.NOT_FOUND, 404, "/families/$hidden/members")
    }

    @Test
    fun `a missing member is not found`() {
        val family = createdFamily()
        val member = UUID.randomUUID()
        mockMvc.put("/families/$family/members/$member") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"firstName":"A","lastName":"B"}"""
        }.problem(ProblemCode.NOT_FOUND, 404, "/families/$family/members/$member")
    }

    @Test
    fun `a taken family name is a conflict`() {
        val name = "Taken ${UUID.randomUUID()}"
        emptyFamily(name).andExpect { status { isCreated() } }
        emptyFamily(name).problem(ProblemCode.NAME_TAKEN, 409, "/families/empty")
    }

    @Test
    fun `a pin another member holds is a conflict`() {
        val family = createdFamily()
        fun member() = mockMvc.post("/families/$family/members") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"firstName":"A","lastName":"B"}"""
        }.andReturn().response.contentAsString.substringAfter("\"id\":\"").substringBefore('"')
        val first = member()
        val second = member()
        fun pin(id: String) = mockMvc.put("/families/$family/members/$id/placement") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"pinId":1}"""
        }
        pin(first).andExpect { status { isNoContent() } }
        pin(second).problem(ProblemCode.PIN_TAKEN, 409, "/families/$family/members/$second/placement")
    }

    @Test
    fun `a body that breaks the schema names the fields`() {
        val family = createdFamily()
        mockMvc.post("/families/$family/members") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"firstName":"${"x".repeat(101)}","lastName":"B"}"""
        }.problem(ProblemCode.VALIDATION_FAILED, 400, "/families/$family/members") {
            jsonPath("$.errors[0].field") { value("firstName") }
            jsonPath("$.errors[0].message") { exists() }
        }
    }

    @Test
    fun `unreadable json is a validation failure without parser details`() {
        mockMvc.post("/families/empty") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"""
        }.problem(ProblemCode.VALIDATION_FAILED, 400, "/families/empty") {
            jsonPath("$.errors") { doesNotExist() }
            content { string(not(containsString("JSON"))) }
        }
    }

    @Test
    fun `photo problems have their own codes`() {
        val family = createdFamily()
        mockMvc.put("/families/$family/photo") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.IMAGE_PNG
            content = ByteArray(2 * 1024 * 1024 + 1)
        }.problem(ProblemCode.PHOTO_TOO_LARGE, 413, "/families/$family/photo")
        mockMvc.put("/families/$family/photo") {
            header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
            contentType = MediaType.IMAGE_GIF
            content = byteArrayOf(1, 2, 3)
        }.problem(ProblemCode.UNSUPPORTED_MEDIA_TYPE, 415, "/families/$family/photo")
    }

    @Test
    fun `an unexpected error hides its message`() {
        val response = ProblemAdvice().handleUnexpected(IllegalStateException("secret Jane Doe"), MockHttpServletRequest("GET", "/families"))
        val problem = response.body!!
        assertEquals(500, response.statusCode.value())
        assertEquals(ProblemCode.INTERNAL_ERROR.value, problem.properties?.get("code"))
        assertEquals("An unexpected error occurred.", problem.detail)
    }
}

// The CSRF filter's 403, which runs before authentication; dev mode reaches it without a token.
@SpringBootTest(properties = ["app.auth.mode=dev", "app.roles.admins=dev@localhost"])
@AutoConfigureMockMvc
@Transactional
class CrossSiteProblemTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    // Without an Origin header: the CORS filter rejects a foreign origin first, with a bare 403 that browsers hide anyway.
    @Test
    fun `a cross-site write is forbidden`() {
        mockMvc.post("/families/empty") {
            header("Sec-Fetch-Site", "cross-site")
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"Cross site"}"""
        }.andExpect {
            status { isForbidden() }
            content { contentType(MediaType.APPLICATION_PROBLEM_JSON) }
            jsonPath("$.code") { value(ProblemCode.FORBIDDEN.value) }
        }
    }
}
