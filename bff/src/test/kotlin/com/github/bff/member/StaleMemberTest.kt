package com.github.bff.member

import com.github.bff.auth.CLOUDFLARE_ACCESS_JWT_HEADER
import com.github.bff.auth.CloudflareTestDecoder
import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.generated.model.CreateEmptyFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Placement
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.put
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

// Not @Transactional: every request commits on its own, as it does for two people editing at once.
@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
class StaleMemberTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberService: MemberService

    private val admin by lazy { token(email = "admin@example.com") }

    private lateinit var family: UUID

    @BeforeTest
    fun createFamily() {
        family = (familyService.createEmpty(CreateEmptyFamilyRequest("Stale member test ${UUID.randomUUID()}")) as FamilyCreationResult.CREATED).summary.id
    }

    @AfterTest
    fun deleteFamily() {
        familyService.delete(family)
    }

    private fun member(id: UUID): Member = memberService.findAll(family)!!.single { it.id == id }

    private fun updateMember(id: UUID, firstName: String, version: Long?) = mockMvc.put("/families/$family/members/$id") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
        contentType = MediaType.APPLICATION_JSON
        content = """{"firstName":"$firstName","lastName":"Müller"${version?.let { ""","version":$it""" } ?: ""}}"""
    }

    private fun updateRelatives(id: UUID, partnerIds: List<UUID>, version: Long?) = mockMvc.put("/families/$family/members/$id/relatives") {
        header(CLOUDFLARE_ACCESS_JWT_HEADER, admin)
        contentType = MediaType.APPLICATION_JSON
        content = """{"parentIds":[],"childIds":[],"partnerIds":[${partnerIds.joinToString { "\"$it\"" }}]""" +
            (version?.let { ""","version":$it}""" } ?: "}")
    }

    private fun ResultActionsDsl.stale() = andExpect {
        status { isConflict() }
        content { contentType(MediaType.APPLICATION_PROBLEM_JSON) }
        jsonPath("$.code") { value("EDIT_CONFLICT") }
    }

    @Test
    fun `an update with the current version succeeds and raises it`() {
        val anna = memberService.create(family, CreateMemberRequest("Anna", "Müller"))!!
        assertEquals(0, anna.version)

        updateMember(anna.id, "Anne", 0).andExpect {
            status { isOk() }
            jsonPath("$.version") { value(1) }
        }
        assertEquals(1, member(anna.id).version)
    }

    @Test
    fun `an update based on an older version is rejected and keeps the newer save`() {
        val anna = memberService.create(family, CreateMemberRequest("Anna", "Müller"))!!
        updateMember(anna.id, "Anne", 0).andExpect { status { isOk() } }

        updateMember(anna.id, "Annika", 0).stale()
        assertEquals("Anne", member(anna.id).firstName)
        assertEquals(1, member(anna.id).version)
    }

    @Test
    fun `an update without a version overwrites whatever is stored`() {
        val anna = memberService.create(family, CreateMemberRequest("Anna", "Müller"))!!
        updateMember(anna.id, "Anne", 0).andExpect { status { isOk() } }

        updateMember(anna.id, "Annika", null).andExpect { status { isOk() } }
        assertEquals("Annika", member(anna.id).firstName)
    }

    @Test
    fun `of two concurrent updates with the same version exactly one succeeds`() {
        val anna = memberService.create(family, CreateMemberRequest("Anna", "Müller"))!!
        val start = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(2)
        val statuses = try {
            listOf("Anne", "Annika")
                .map { name -> executor.submit<Int> { start.await(); updateMember(anna.id, name, 0).andReturn().response.status } }
                .also { start.countDown() }
                .map { it.get(30, TimeUnit.SECONDS) }
        } finally {
            executor.shutdown()
        }

        assertEquals(listOf(200, 409), statuses.sorted())
        assertEquals(1, member(anna.id).version)
    }

    @Test
    fun `relatives based on an older version are rejected and keep the links`() {
        val anna = memberService.create(family, CreateMemberRequest("Anna", "Müller"))!!
        val bernd = memberService.create(family, CreateMemberRequest("Bernd", "Müller"))!!
        updateMember(anna.id, "Anne", 0).andExpect { status { isOk() } }

        updateRelatives(anna.id, listOf(bernd.id), 0).stale()
        assertEquals(emptyList(), member(anna.id).partnerIds)
    }

    @Test
    fun `relatives raise the version of every member whose links change`() {
        val anna = memberService.create(family, CreateMemberRequest("Anna", "Müller"))!!
        val bernd = memberService.create(family, CreateMemberRequest("Bernd", "Müller"))!!
        val clara = memberService.create(family, CreateMemberRequest("Clara", "Müller"))!!

        updateRelatives(anna.id, listOf(bernd.id), 0).andExpect { status { isNoContent() } }
        assertEquals(listOf(1L, 1L, 0L), listOf(anna, bernd, clara).map { member(it.id).version })

        // Bernd's open edit still shows Anna as his partner, so saving it now would be stale.
        updateMember(bernd.id, "Bernhard", 0).stale()

        // Unchanged relatives leave the versions alone; without a version they apply whatever is stored.
        updateRelatives(anna.id, listOf(bernd.id), null).andExpect { status { isNoContent() } }
        assertEquals(listOf(1L, 1L, 0L), listOf(anna, bernd, clara).map { member(it.id).version })
    }

    @Test
    fun `moving a card leaves the version alone`() {
        val anna = memberService.create(family, CreateMemberRequest("Anna", "Müller"))!!
        memberService.updatePlacement(family, anna.id, Placement().pinId(3))

        assertEquals(3, member(anna.id).pinId)
        assertEquals(0, member(anna.id).version)
    }
}
