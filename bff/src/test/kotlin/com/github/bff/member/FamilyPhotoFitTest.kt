package com.github.bff.member

import com.github.bff.auth.CurrentUser
import com.github.bff.auth.CurrentUserAuthentication
import com.github.bff.auth.Access
import com.github.bff.generated.model.CreateFamilyRequest
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test

@SpringBootTest
@Transactional
class FamilyPhotoFitTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var context: WebApplicationContext

    private lateinit var mvc: MockMvc

    @BeforeTest
    fun setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build()
        // Without the security filters, an admin in the context lets the visibility filter show test families.
        SecurityContextHolder.getContext().authentication =
            CurrentUserAuthentication(CurrentUser("admin@example.com", Access(admin = true), verified = true))
    }

    @AfterTest
    fun tearDown() = SecurityContextHolder.clearContext()

    private fun createFamily() =
        (familyService.create(CreateFamilyRequest("Family photo fit test ${UUID.randomUUID()}", 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id

    private fun setFit(family: UUID, body: String) =
        mvc.perform(put("/families/{familyId}/photo-fit", family).contentType(MediaType.APPLICATION_JSON).content(body))

    private fun fitOf(family: UUID) = jsonPath("$[?(@.id == '$family')].photoFit")

    @Test
    fun `starts with cover and stores original`() {
        val family = createFamily()
        mvc.perform(get("/families")).andExpect(fitOf(family).value("cover"))

        setFit(family, """{"photoFit":"original"}""")
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.photoFit").value("original"))
        mvc.perform(get("/families")).andExpect(fitOf(family).value("original"))
    }

    @Test
    fun `rejects unknown values and unknown families`() {
        val family = createFamily()
        setFit(family, """{"photoFit":"stretch"}""").andExpect(status().isBadRequest)
        setFit(family, "{}").andExpect(status().isBadRequest)
        setFit(UUID.randomUUID(), """{"photoFit":"cover"}""").andExpect(status().isNotFound)
    }
}
