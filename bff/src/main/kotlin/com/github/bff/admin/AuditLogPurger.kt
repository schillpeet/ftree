package com.github.bff.admin

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.OffsetDateTime

// Keeps the audit log short: changes to persons in a tree (category content) for app.audit.content-retention, every
// other entry for app.audit.retention.
@Component
class AuditLogPurger(
    private val jdbc: JdbcTemplate,
    @Value("\${app.audit.content-retention:90d}") private val contentRetention: Duration,
    @Value("\${app.audit.retention:365d}") private val retention: Duration,
) {
    // Tests set the time.
    internal var clock: Clock = Clock.systemUTC()

    // Returns how many entries were deleted.
    @Scheduled(cron = "\${app.audit.purge-cron:0 45 3 * * *}")
    fun purge(): Int {
        val now = OffsetDateTime.now(clock)
        val purged = jdbc.update(
            "DELETE FROM audit_log WHERE (category = 'content' AND at < ?) OR at < ?",
            now - contentRetention, now - retention,
        )
        if (purged > 0) log.info("Purged {} entries from the audit log", purged)
        return purged
    }

    private companion object {
        val log = LoggerFactory.getLogger(AuditLogPurger::class.java)
    }
}
