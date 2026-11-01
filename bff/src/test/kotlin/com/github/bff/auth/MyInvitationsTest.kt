package com.github.bff.auth

import com.github.bff.auth.CloudflareTestTokens.token
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID
import kotlin.test.Test

// GET /me/invitations lists what the caller invited: pending ones (never signed in) first, then accepted ones.
@SpringBootTest(properties = ["app.roles.admins=admin@example.com"])
@AutoConfigureMockMvc
@Import(CloudflareTestDecoder::class)
@Transactional
class MyInvitationsTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val run = UUID.randomUUID().toString().take(8)
    private val sender = "sender-$run@example.com"
    private val pending = "pending-$run@example.com"
    private val accepted = "accepted-$run@example.com"

    @Test
    fun `lists the invitations the caller sent, pending first, without trashed trees or others' invitations`() {
        val tree = familyRepository.saveAndFlush(FamilyEntity(name = "Mine $run", slug = "mine-$run")).id
        val trashed = familyRepository.saveAndFlush(FamilyEntity(name = "Trashed $run", slug = "trashed-$run", deletedAt = Instant.now())).id
        memberships.grant(tree, sender, Role.OWNER, sender)
        memberships.grant(tree, accepted, Role.EDITOR, sender)
        memberships.grant(tree, pending, Role.VISITOR, sender)
        memberships.grant(trashed, pending, Role.VISITOR, sender)
        memberships.grant(tree, "other-$run@example.com", Role.VISITOR, "someone-$run@example.com")
        jdbc.update("UPDATE users SET first_seen = now(), last_seen = now() WHERE email = ?", accepted)

        mockMvc.get("/me/invitations") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = sender)) }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(2) }
            jsonPath("$[0].email") { value(pending) }
            jsonPath("$[0].status") { value("pending") }
            jsonPath("$[0].role") { value("visitor") }
            jsonPath("$[0].familyId") { value(tree.toString()) }
            jsonPath("$[0].familyName") { value("Mine $run") }
            jsonPath("$[0].invitedAt") { exists() }
            jsonPath("$[1].email") { value(accepted) }
            jsonPath("$[1].status") { value("accepted") }
            jsonPath("$[1].role") { value("editor") }
        }
    }

    @Test
    fun `someone who invited nobody gets an empty list`() {
        mockMvc.get("/me/invitations") { header(CLOUDFLARE_ACCESS_JWT_HEADER, token(email = "nobody-$run@example.com")) }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(0) }
        }
    }
}
