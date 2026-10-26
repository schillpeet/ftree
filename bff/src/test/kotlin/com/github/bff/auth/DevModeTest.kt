package com.github.bff.auth

import jakarta.servlet.http.Cookie
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test

@SpringBootTest(properties = ["app.auth.mode=dev", "app.roles.admins=dev@localhost"])
@AutoConfigureMockMvc
@Transactional
class DevModeTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Test
    fun `me returns the unverified dev user with all admin permissions`() {
        mockMvc.get("/me").andExpect {
            status { isOk() }
            jsonPath("$.email") { value("dev@localhost") }
            jsonPath("$.admin") { value(true) }
            jsonPath("$.verified") { value(false) }
            jsonPath("$.permissions.length()") { value(13) }
            jsonPath("$.permissions[0]") { value("tree.view") }
            jsonPath("$.permissions[12]") { value("users.manage") }
        }
    }

    @Test
    fun `the dev email cookie signs in as someone else`() {
        mockMvc.get("/me") { cookie(Cookie(DevAuthenticationFilter.DEV_EMAIL_COOKIE, "visitor@example.com")) }.andExpect {
            status { isOk() }
            jsonPath("$.email") { value("visitor@example.com") }
            jsonPath("$.admin") { value(false) }
            jsonPath("$.verified") { value(false) }
        }
        // Anything that is not an email falls back to the dev user.
        listOf("", "not-an-email", "a b@example.com", "x".repeat(320) + "@example.com").forEach { value ->
            mockMvc.get("/me") { cookie(Cookie(DevAuthenticationFilter.DEV_EMAIL_COOKIE, value)) }.andExpect {
                jsonPath("$.email") { value("dev@localhost") }
            }
        }
    }

    @Test
    fun `post works without a csrf token`() {
        mockMvc.post("/families") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"name":"Csrf test ${UUID.randomUUID()}","totalUsers":1,"generationCount":1,"minChildren":0,"maxChildren":0}"""
        }.andExpect { status { isCreated() } }
    }

    // A second line of defence: a cross-site form can only send text/plain or form encodings.
    @Test
    fun `post rejects bodies a cross-site form can send`() {
        listOf(MediaType.TEXT_PLAIN, MediaType.APPLICATION_FORM_URLENCODED).forEach { type ->
            mockMvc.post("/families") {
                contentType = type
                content = """{"name":"Csrf test ${UUID.randomUUID()}","totalUsers":1,"generationCount":1,"minChildren":0,"maxChildren":0}"""
            }.andExpect { status { isUnsupportedMediaType() } }
        }
    }

    @Test
    fun `writes from other sites are forbidden, same-origin writes pass`() {
        val body = """{"name":"Csrf test ${UUID.randomUUID()}","totalUsers":1,"generationCount":1,"minChildren":0,"maxChildren":0}"""
        mockMvc.post("/families") {
            contentType = MediaType.APPLICATION_JSON
            content = body
            header("Sec-Fetch-Site", "cross-site")
            header("Origin", "https://evil.example")
        }.andExpect { status { isForbidden() } }
        mockMvc.delete("/families/${UUID.randomUUID()}") {
            header("Origin", "https://evil.example")
        }.andExpect { status { isForbidden() } }
        mockMvc.post("/families") {
            contentType = MediaType.APPLICATION_JSON
            content = body
            header("Sec-Fetch-Site", "same-origin")
            header("Origin", "http://localhost:3000")
        }.andExpect {
            status { isCreated() }
            header { doesNotExist("Set-Cookie") }
        }
    }
}
