package com.github.bff.auth.access

import com.github.bff.auth.AccessChanged
import com.github.bff.auth.AccessPolicy
import com.github.bff.auth.AuditLog
import com.github.bff.auth.Memberships
import com.github.bff.auth.Role
import com.github.bff.generated.model.AccessSyncResult
import com.github.bff.generated.model.ProblemCode
import com.github.bff.member.FamilyEntity
import com.github.bff.member.FamilyRepository
import com.github.bff.problem.ApiProblem
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.util.UUID
import javax.sql.DataSource
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class AccessSyncTest {
    @Autowired
    private lateinit var jdbc: JdbcTemplate

    @Autowired
    private lateinit var dataSource: DataSource

    @Autowired
    private lateinit var transactionManager: PlatformTransactionManager

    @Autowired
    private lateinit var accessPolicy: AccessPolicy

    @Autowired
    private lateinit var memberships: Memberships

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var auditLog: AuditLog

    // The Access group in memory.
    private class FakeGateway(var group: Set<String> = emptySet()) : AccessGateway {
        val replaced = mutableListOf<Set<String>>()
        val revoked = mutableListOf<String>()
        var failing = false
        override val configured = true

        override fun members(): Set<String> = if (failing) throw AccessGatewayException("Cloudflare API answered GET with 500") else group

        override fun replace(emails: Collection<String>): Boolean {
            replaced += emails.toSet()
            group = emails.toSet()
            return true
        }

        override fun revokeSessions(email: String) {
            revoked += email
        }
    }

    private val gateway = FakeGateway()
    private val syncs = mutableListOf<AccessSync>()

    private fun seats(properties: AccessSyncProperties = AccessSyncProperties()) = AccessSeats(jdbc, accessPolicy, memberships, properties)

    private fun sync(properties: AccessSyncProperties = AccessSyncProperties(), accessGateway: AccessGateway = gateway) =
        AccessSync(jdbc, transactionManager, seats(properties), accessGateway, properties, Duration.ofMillis(50)).also { syncs += it }

    private fun people() = seats().people().toSet()

    private fun strangers(count: Int) = (1..count).map { "stranger-$it-$RUN@example.com" }.toSet()

    // Six people with a role, so that one change is never half of the group.
    @BeforeTest
    fun grantSome() {
        val tree = familyRepository.saveAndFlush(FamilyEntity(name = "Sync $RUN", slug = "sync-$RUN")).id
        (1..6).forEach { memberships.grant(tree, "member-$it-$RUN@example.com", Role.VISITOR, null) }
    }

    @AfterTest
    fun stopSyncs() = syncs.forEach { it.stop() }

    @Test
    fun `writes everyone with access and ends the sessions of whoever is removed`() {
        val stranger = "stranger-$RUN@example.com"
        gateway.group = people() - "member-1-$RUN@example.com" + stranger
        val sync = sync()

        val status = assertNotNull(sync.run())

        assertEquals(AccessSyncResult.SYNCED, status.result)
        assertEquals(listOf(people()), gateway.replaced)
        assertEquals(listOf(stranger), gateway.revoked)
        assertEquals(Triple(people().size, 1, 1), Triple(status.members, status.added, status.removed))
        assertEquals(status, sync.status)
    }

    @Test
    fun `the list covers bootstrap admins, global rights, and roles in trees in the trash`() {
        val trashed = familyRepository.saveAndFlush(FamilyEntity(name = "Sync trash $RUN", slug = "sync-trash-$RUN")).id
        memberships.grant(trashed, "trashed-$RUN@example.com", Role.EDITOR, null)
        jdbc.update("UPDATE families SET deleted_at = now() WHERE id = ?", trashed)
        memberships.grantFlags("creator-$RUN@example.com", admin = false, canCreateTrees = true, grantedBy = null)
        memberships.grantFlags("admin-$RUN@example.com", admin = true, canCreateTrees = false, grantedBy = null)
        jdbc.update("INSERT INTO users (email, first_seen, last_seen) VALUES (?, now(), now())", "nobody-$RUN@example.com")

        val people = people()
        assertTrue(people.containsAll(listOf("trashed-$RUN@example.com", "creator-$RUN@example.com", "admin-$RUN@example.com")))
        assertTrue(people.containsAll(accessPolicy.bootstrapAdmins()))
        assertTrue("nobody-$RUN@example.com" !in people)
    }

    @Test
    fun `a group that already matches is left alone`() {
        gateway.group = people()
        assertEquals(AccessSyncResult.UNCHANGED, sync().run()?.result)
        assertEquals(emptyList(), gateway.replaced)
    }

    @Test
    @ExtendWith(OutputCaptureExtension::class)
    fun `a group that stays unchanged is logged once`(output: CapturedOutput) {
        gateway.group = people()
        val sync = sync()
        sync.run()
        sync.run()
        assertEquals(1, Regex("Access sync: nothing to change").findAll(output.all).count())
    }

    @Test
    fun `only one run at a time holds the lock`() {
        gateway.group = setOf("stranger-$RUN@example.com")
        dataSource.connection.use { other ->
            other.createStatement().use { it.execute("SELECT pg_advisory_lock(${AccessSeats.SYNC_LOCK})") }
            try {
                assertNull(sync(AccessSyncProperties(force = true)).run())
                assertEquals(emptyList(), gateway.replaced)
            } finally {
                other.createStatement().use { it.execute("SELECT pg_advisory_unlock(${AccessSeats.SYNC_LOCK})") }
            }
        }
        assertEquals(AccessSyncResult.SYNCED, sync(AccessSyncProperties(force = true)).run()?.result)
    }

    @Test
    fun `a dry run only counts`() {
        gateway.group = people() - "member-1-$RUN@example.com" + strangers(2)
        val status = assertNotNull(sync(AccessSyncProperties(dryRun = true)).run())

        assertEquals(AccessSyncResult.DRY_RUN, status.result)
        assertEquals(1 to 2, status.added to status.removed)
        assertEquals(emptyList(), gateway.replaced)
        assertEquals(emptyList(), gateway.revoked)
    }

    @Test
    fun `removing more than the limit at once is refused unless forced`() {
        gateway.group = people() + strangers(6)
        val blocked = assertNotNull(sync(AccessSyncProperties(maxRemovals = 5)).run())
        assertEquals(AccessSyncResult.BLOCKED, blocked.result)
        assertEquals(6, blocked.removed)
        assertEquals(emptyList(), gateway.replaced)

        assertEquals(AccessSyncResult.SYNCED, sync(AccessSyncProperties(maxRemovals = 5, force = true)).run()?.result)
        assertEquals(people(), gateway.group)
        assertEquals(6, gateway.revoked.size)
    }

    @Test
    fun `removing more than half of the group is refused`() {
        gateway.group = people() + strangers(people().size + 1)
        assertEquals(AccessSyncResult.BLOCKED, sync(AccessSyncProperties(maxRemovals = Int.MAX_VALUE)).run()?.result)
        assertEquals(emptyList(), gateway.replaced)
    }

    @Test
    fun `a failing Cloudflare and a missing token are reported`() {
        gateway.failing = true
        assertEquals(AccessSyncResult.FAILED, sync().run()?.result)
        assertEquals(AccessSyncResult.DISABLED, sync(accessGateway = NoopAccessGateway).run()?.result)
    }

    // The run happens on the sync's own thread, in its own transaction, after the change was committed.
    @Test
    fun `a change of access starts a run`() {
        gateway.group = setOf("stranger-$RUN@example.com")
        val sync = sync(AccessSyncProperties(force = true))
        sync.onAccessChanged(AccessChanged("someone@example.com", null))

        val deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos()
        while (sync.status == null && System.nanoTime() < deadline) Thread.sleep(20)
        assertEquals(AccessSyncResult.SYNCED, sync.status?.result)
        assertEquals(1, gateway.replaced.size)
    }

    @Test
    fun `nobody new gets access once every seat is taken`() {
        val taken = seats().people()
        val full = seats(AccessSyncProperties(seatLimit = taken.size))

        val problem = assertFailsWith<ApiProblem> { full.requireSeatFor("new-$RUN@example.com") }
        assertEquals(ProblemCode.SEATS_EXHAUSTED, problem.code)
        // Someone with a seat keeps passing, for example when their role changes.
        full.requireSeatFor(" ${taken.first().uppercase()}")
        seats(AccessSyncProperties(seatLimit = taken.size + 1)).requireSeatFor("new-$RUN@example.com")
    }

    @Test
    fun `ending someone's sessions asks Cloudflare and is audited`() {
        val email = "member-1-$RUN@example.com"
        val id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID::class.java, email)!!
        AccessSessions(jdbc, gateway, auditLog).revoke(id, "admin@example.com")

        assertEquals(listOf(email), gateway.revoked)
        assertEquals(
            listOf("admin@example.com"),
            jdbc.queryForList("SELECT actor FROM audit_log WHERE action = 'user.sessions.revoked' AND target_id = ?", String::class.java, email),
        )
        val unknown = assertFailsWith<ApiProblem> { AccessSessions(jdbc, gateway, auditLog).revoke(UUID.randomUUID(), "admin@example.com") }
        assertEquals(ProblemCode.NOT_FOUND, unknown.code)
    }

    private companion object {
        val RUN = UUID.randomUUID().toString().take(8)
    }
}
