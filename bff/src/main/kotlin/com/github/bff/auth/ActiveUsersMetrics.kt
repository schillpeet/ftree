package com.github.bff.auth

import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.binder.MeterBinder
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.Instant

// ftree.users.active{window=1d|7d|30d}: how many people were last seen within that window. One query serves the three
// gauges and its answer is kept for CACHE, so a scrape does not always reach the database. Counts only, never who.
@Component
class ActiveUsersMetrics(private val jdbc: JdbcTemplate) : MeterBinder {
    internal var clock: Clock = Clock.systemUTC()

    private var counts: Map<String, Double> = WINDOWS.keys.associateWith { Double.NaN }
    private var loaded: Instant? = null

    override fun bindTo(registry: MeterRegistry) {
        WINDOWS.keys.forEach { window ->
            Gauge.builder("ftree.users.active") { count(window) }
                .tag("window", window)
                .description("People whose last sign-in is within the window")
                .register(registry)
        }
    }

    @Synchronized
    private fun count(window: String): Double {
        val now = clock.instant()
        if (loaded?.let { now.isBefore(it + CACHE) } != true) {
            // A failed query is not retried before CACHE has passed, and the scrape keeps the last counts, or NaN before any.
            loaded = now
            try {
                counts = query()
            } catch (exception: RuntimeException) {
                log.warn("Could not count the active users: {}", exception.javaClass.name)
            }
        }
        return counts.getValue(window)
    }

    private fun query(): Map<String, Double> =
        jdbc.queryForObject(
            "SELECT " + WINDOWS.values.joinToString(", ") { "count(*) FILTER (WHERE last_seen >= now() - interval '$it')" } + " FROM users",
        ) { rs, _ -> WINDOWS.keys.withIndex().associate { (index, window) -> window to rs.getLong(index + 1).toDouble() } }

    private companion object {
        val log = LoggerFactory.getLogger(ActiveUsersMetrics::class.java)
        val CACHE: Duration = Duration.ofSeconds(60)

        // Metric tag to SQL interval.
        val WINDOWS = linkedMapOf("1d" to "1 day", "7d" to "7 days", "30d" to "30 days")
    }
}
