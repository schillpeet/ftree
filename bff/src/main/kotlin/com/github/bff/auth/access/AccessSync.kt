package com.github.bff.auth.access

import com.github.bff.auth.AccessChanged
import com.github.bff.generated.model.AccessSyncResult
import com.github.bff.generated.model.AccessSyncStatus
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.event.EventListener
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

// Keeps the Cloudflare Access group equal to AccessSeats.people(): after every AccessChanged, which is published after
// the commit, and every 10 minutes, so a missed or failed run catches up. Runs take turns on one thread here and on a
// PostgreSQL advisory lock across BFF instances. The log names counts only, never emails.
@Component
class AccessSync(
    private val jdbc: JdbcTemplate,
    transactionManager: PlatformTransactionManager,
    private val seats: AccessSeats,
    private val gateway: AccessGateway,
    private val properties: AccessSyncProperties,
    meters: MeterRegistry,
    @Value("\${app.access-sync.retry-delay:5s}")
    private val retryDelay: Duration = Duration.ofSeconds(5),
) {
    private val transactions = TransactionTemplate(transactionManager)
    private val executor = Executors.newSingleThreadScheduledExecutor { Thread(it, "access-sync").apply { isDaemon = true } }
    private val requested = AtomicBoolean(false)

    // Registered up front, so every series exists from the first scrape and rate() has a start.
    private val runs = AccessSyncResult.entries.associateWith { Counter.builder("ftree.access.sync.runs").tag("result", it.value).register(meters) }
    private val added = Counter.builder("ftree.access.sync.changes").tag("change", "added").register(meters)
    private val removed = Counter.builder("ftree.access.sync.changes").tag("change", "removed").register(meters)

    @Volatile
    private var last: AccessSyncStatus? = null

    // The last run of this instance, for the admin overview; null before the first.
    val status: AccessSyncStatus? get() = last

    @EventListener
    fun onAccessChanged(event: AccessChanged) = request()

    @Scheduled(fixedDelayString = "\${app.access-sync.interval:10m}", initialDelayString = "\${app.access-sync.initial-delay:1m}")
    fun scheduled() = request()

    // Changes that arrive while a run waits share it; one that arrives during a run gets the next. A run skipped because
    // another instance holds the lock is tried again shortly.
    fun request(delay: Duration = Duration.ZERO) {
        if (!requested.compareAndSet(false, true)) return
        executor.schedule({
            requested.set(false)
            try {
                if (run() == null) request(retryDelay)
            } catch (exception: RuntimeException) {
                log.error("Access sync stopped with {}", exception.javaClass.name)
            }
        }, delay.toMillis(), TimeUnit.MILLISECONDS)
    }

    // One sync; null when another run holds the lock.
    fun run(): AccessSyncStatus? {
        if (!gateway.configured) return record(AccessSyncResult.DISABLED, seats.people().size, 0, 0)
        return transactions.execute {
            val locked = jdbc.queryForObject("SELECT pg_try_advisory_xact_lock(?)", Boolean::class.java, AccessSeats.SYNC_LOCK) == true
            if (locked) sync() else null.also { log.info("Access sync skipped: another run holds the lock") }
        }
    }

    private fun sync(): AccessSyncStatus {
        val wanted = seats.people().toSet()
        val current = try {
            gateway.members()
        } catch (exception: AccessGatewayException) {
            return failed(exception, wanted.size)
        }
        val added = wanted - current
        val removed = current - wanted
        if (added.isEmpty() && removed.isEmpty()) {
            // Logged once, not on every scheduled run, so the log still shows that the sync works.
            if (last?.result != AccessSyncResult.UNCHANGED) log.info("Access sync: nothing to change, {} in total", wanted.size)
            return record(AccessSyncResult.UNCHANGED, wanted.size, 0, 0)
        }
        if (!properties.force && (removed.size > properties.maxRemovals || removed.size * 2 > current.size)) {
            log.warn(
                "Access sync blocked: it would remove {} of {} addresses, more than {} or half; set ACCESS_SYNC_FORCE=true to allow it",
                removed.size, current.size, properties.maxRemovals,
            )
            return record(AccessSyncResult.BLOCKED, wanted.size, added.size, removed.size)
        }
        if (properties.dryRun) {
            log.info("Access sync dry run: would add {} and remove {} addresses, {} in total", added.size, removed.size, wanted.size)
            return record(AccessSyncResult.DRY_RUN, wanted.size, added.size, removed.size)
        }
        try {
            gateway.replace(wanted)
        } catch (exception: AccessGatewayException) {
            return failed(exception, wanted.size)
        }
        // Removed people would otherwise keep their Access session for up to 24 hours.
        val unrevoked = removed.count { email -> runCatching { gateway.revokeSessions(email) }.isFailure }
        log.info("Access sync: added {} and removed {} addresses, {} in total", added.size, removed.size, wanted.size)
        if (unrevoked > 0) log.warn("Access sync could not end the sessions of {} removed people", unrevoked)
        return record(AccessSyncResult.SYNCED, wanted.size, added.size, removed.size)
    }

    private fun failed(exception: AccessGatewayException, members: Int): AccessSyncStatus {
        log.warn("Access sync failed: {}", exception.message)
        return record(AccessSyncResult.FAILED, members, 0, 0)
    }

    private fun record(result: AccessSyncResult, members: Int, added: Int, removed: Int) =
        AccessSyncStatus(OffsetDateTime.now(ZoneOffset.UTC), result, members, added, removed).also {
            last = it
            runs.getValue(result).increment()
            // Only what was written; a dry run or a blocked run changed nothing.
            if (result == AccessSyncResult.SYNCED) {
                this.added.increment(added.toDouble())
                this.removed.increment(removed.toDouble())
            }
        }

    @PreDestroy
    fun stop() {
        executor.shutdownNow()
    }

    private companion object {
        val log = LoggerFactory.getLogger(AccessSync::class.java)
    }
}
