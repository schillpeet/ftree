package com.github.bff.admin

import com.github.bff.auth.AuditLog
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class AuditLogPurgerTest {
    @Autowired
    private lateinit var purger: AuditLogPurger

    @Autowired
    private lateinit var auditLog: AuditLog

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    @AfterTest
    fun resetClock() {
        purger.clock = Clock.systemUTC()
    }

    @Test
    fun `content goes after 90 days, everything else after 12 months`() {
        val family = UUID.randomUUID().toString()
        // Days before the fixed now of 2026-06-01 at which each entry was made.
        listOf("member.updated" to 89, "member.created" to 91, "family.renamed" to 91, "membership.granted" to 364, "family.trashed" to 366)
            .forEach { (action, days) ->
                auditLog.record(null, action, "family", family)
                jdbc.update(
                    "UPDATE audit_log SET at = timestamptz '2026-06-01T00:00:00Z' - make_interval(days => ?) WHERE target_id = ? AND action = ?",
                    days, family, action,
                )
            }
        purger.clock = Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC)

        purger.purge()

        assertEquals(
            listOf("family.renamed", "member.updated", "membership.granted"),
            jdbc.queryForList("SELECT action FROM audit_log WHERE target_id = ?", String::class.java, family).filterNotNull().sorted(),
        )
    }
}
