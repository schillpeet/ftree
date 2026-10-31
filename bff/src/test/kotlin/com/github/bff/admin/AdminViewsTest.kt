package com.github.bff.admin

import com.github.bff.auth.Access
import com.github.bff.auth.CurrentUser
import com.github.bff.auth.CurrentUserAuthentication
import com.github.bff.auth.Role
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.servlet.HandlerMapping
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class AdminViewsTest {
    @Autowired
    private lateinit var adminViews: AdminViews

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val family = UUID.randomUUID()
    private val admin = "views-${UUID.randomUUID()}@example.com"

    @AfterTest
    fun signOut() {
        SecurityContextHolder.clearContext()
        adminViews.clock = Clock.systemUTC()
    }

    private fun open(access: Access, pattern: String = "/families/{familyId}/members", method: String = "GET") {
        SecurityContextHolder.getContext().authentication = CurrentUserAuthentication(CurrentUser(admin, access, verified = true))
        val request = MockHttpServletRequest(method, "/families/$family/members").apply {
            setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, pattern)
            setAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, mapOf("familyId" to family.toString()))
        }
        adminViews.preHandle(request, MockHttpServletResponse(), Any())
    }

    private fun views() =
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_log WHERE action = 'admin.tree.viewed' AND actor = ? AND target_id = ? AND category = 'admin'",
            Int::class.java,
            admin,
            family.toString(),
        )

    @Test
    fun `an admin opening a tree without a role in it is written down once an hour`() {
        val start = Instant.parse("2026-10-31T12:00:00Z")
        adminViews.clock = Clock.fixed(start, ZoneOffset.UTC)
        open(Access(admin = true))
        open(Access(admin = true))
        assertEquals(1, views())

        adminViews.clock = Clock.fixed(start + Duration.ofMinutes(61), ZoneOffset.UTC)
        open(Access(admin = true))
        assertEquals(2, views())
    }

    @Test
    fun `members, ordinary users, and other requests are not written down`() {
        open(Access(admin = true, memberships = mapOf(family to Role.OWNER)))
        open(Access(admin = false))
        open(Access(admin = true), pattern = "/families/{familyId}/members/{memberId}")
        open(Access(admin = true), method = "POST")
        assertEquals(0, views())
    }
}
