package com.github.bff.auth

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import kotlin.test.Test

@SpringBootTest(properties = ["app.roles.admins=dev@localhost"])
@AutoConfigureMockMvc
class CloudflareModeTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Test
    fun `me without a signed-in user is unauthorized`() {
        mockMvc.get("/me").andExpect { status { isUnauthorized() } }
    }
}
