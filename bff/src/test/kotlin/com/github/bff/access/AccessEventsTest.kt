package com.github.bff.access

import com.github.bff.auth.AccessChanged
import com.github.bff.auth.Memberships
import com.github.bff.auth.Role
import com.github.bff.generated.model.TreeRole
import com.github.bff.generated.model.UpdateAdminUserRequest
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.event.ApplicationEvents
import org.springframework.test.context.event.RecordApplicationEvents
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

// Not @Transactional: the events only follow a commit, so the changes here are committed and removed afterwards.
@SpringBootTest
@RecordApplicationEvents
class AccessEventsTest {
    @Autowired
    private lateinit var events: ApplicationEvents

    @Autowired
    private lateinit var trees: TreeAccessService

    @Autowired
    private lateinit var people: PeopleService

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var transactions: TransactionTemplate

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private lateinit var tree: UUID

    @BeforeTest
    fun createTree() {
        tree = familyRepository.saveAndFlush(FamilyEntity(name = "Events $RUN", slug = "events-$RUN")).id
        memberships.grant(tree, OWNER, Role.OWNER, null)
        events.clear()
    }

    @AfterTest
    fun removeTree() {
        familyRepository.deleteById(tree)
        jdbc.update("DELETE FROM users WHERE email IN (?, ?)", OWNER, GUEST)
    }

    private fun ours() = events.stream(AccessChanged::class.java).toList().filter { it.email in setOf(OWNER, GUEST) }

    @Test
    fun `changes are announced after the commit, and rolled back ones never`() {
        transactions.executeWithoutResult {
            trees.share(tree, GUEST, TreeRole.VISITOR, OWNER, null)
            assertEquals(emptyList(), ours(), "published before the commit")
        }
        assertEquals(listOf(AccessChanged(GUEST, tree)), ours())

        events.clear()
        transactions.executeWithoutResult { status ->
            trees.share(tree, GUEST, TreeRole.EDITOR, OWNER, null)
            status.setRollbackOnly()
        }
        assertEquals(emptyList(), ours())

        // Sharing a role the person already has changes nothing and announces nothing.
        trees.share(tree, GUEST, TreeRole.VISITOR, OWNER, null)
        assertEquals(emptyList(), ours())

        val guest = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID::class.java, GUEST)!!
        trees.transfer(tree, guest, OWNER)
        assertEquals(setOf(AccessChanged(GUEST, tree), AccessChanged(OWNER, tree)), ours().toSet())

        events.clear()
        people.update(guest, UpdateAdminUserRequest().canCreateTrees(true), OWNER)
        // A display name is no right, so changing it announces nothing.
        people.update(guest, UpdateAdminUserRequest().displayName("Guest"), OWNER)
        trees.revoke(tree, jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID::class.java, OWNER)!!, GUEST)
        assertEquals(listOf(AccessChanged(GUEST, null), AccessChanged(OWNER, tree)), ours())
    }

    companion object {
        private val RUN = UUID.randomUUID().toString().take(8)
        private val OWNER = "ev-owner-$RUN@example.com"
        private val GUEST = "ev-guest-$RUN@example.com"
    }
}
