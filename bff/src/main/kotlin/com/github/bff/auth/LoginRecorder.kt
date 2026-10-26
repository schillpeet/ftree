package com.github.bff.auth

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.concurrent.ConcurrentHashMap

// Records who signed in and when they were first and last seen, writing at most once per INTERVAL per person; the last writes
// are kept in memory only, so a restart writes once more for everyone.
@Component
class LoginRecorder(private val jdbc: JdbcTemplate) {
    internal var clock: Clock = Clock.systemUTC()
    private val recorded = ConcurrentHashMap<String, Instant>()

    fun record(email: String) {
        val key = email.normalizedEmail()
        val now = clock.instant()
        var due = false
        recorded.compute(key) { _, last ->
            if (last == null || !now.isBefore(last + INTERVAL)) now.also { due = true } else last
        }
        if (!due) return
        try {
            val at = OffsetDateTime.ofInstant(now, ZoneOffset.UTC)
            jdbc.update(
                "INSERT INTO users (email, first_seen, last_seen) VALUES (?, ?, ?) " +
                    "ON CONFLICT (email) DO UPDATE SET first_seen = coalesce(users.first_seen, excluded.first_seen), last_seen = excluded.last_seen",
                key, at, at,
            )
        } catch (exception: RuntimeException) {
            // Tries again with the next request.
            recorded.remove(key, now)
            throw exception
        }
    }

    // Both null for someone who has a right but never signed in.
    data class Login(val firstSeen: OffsetDateTime?, val lastSeen: OffsetDateTime?)

    fun logins(): Map<String, Login> =
        jdbc.query("SELECT email, first_seen, last_seen FROM users") { rs, _ ->
            rs.getString(1) to Login(rs.getObject(2, OffsetDateTime::class.java), rs.getObject(3, OffsetDateTime::class.java))
        }.toMap()

    companion object {
        val INTERVAL: Duration = Duration.ofMinutes(5)
    }
}

// Records the signed-in user of every request that reaches a controller; a failure is logged, not answered.
@Component
class LoginRecordingInterceptor(private val loginRecorder: LoginRecorder) : HandlerInterceptor {
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val user = CurrentUser.current() ?: return true
        try {
            loginRecorder.record(user.email)
        } catch (exception: RuntimeException) {
            log.warn("Could not record the sign-in", exception)
        }
        return true
    }

    private companion object {
        val log = LoggerFactory.getLogger(LoginRecordingInterceptor::class.java)
    }
}
