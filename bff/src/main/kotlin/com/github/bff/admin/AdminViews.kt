package com.github.bff.admin

import com.github.bff.auth.AuditLog
import com.github.bff.auth.CurrentUser
import com.github.bff.auth.normalizedEmail
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import org.springframework.web.servlet.HandlerMapping
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// Writes admin.tree.viewed when an admin opens a tree they hold no role in (its member list, which every view of a tree
// loads first), at most once per admin and tree within VIEW_WINDOW, so the log shows that someone looked without
// listing every reload. The window lives in memory only, so a restart may record a view once more.
@Component
class AdminViews(private val auditLog: AuditLog) : HandlerInterceptor {
    internal var clock: Clock = Clock.systemUTC()
    private val lastRecorded = ConcurrentHashMap<Pair<String, UUID>, Instant>()

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        if (request.method != "GET" || request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE) != MEMBERS) return true
        val user = CurrentUser.current() ?: return true
        val variables = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE) as? Map<*, *>
        val familyId = (variables?.get("familyId") as? String)?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return true
        if (user.access.admin && familyId !in user.access.memberships) recordView(user.email.normalizedEmail(), familyId)
        return true
    }

    private fun recordView(email: String, familyId: UUID) {
        val now = clock.instant()
        var due = false
        lastRecorded.compute(email to familyId) { _, last ->
            if (last == null || Duration.between(last, now) >= VIEW_WINDOW) now.also { due = true } else last
        }
        if (due) auditLog.record(email, "admin.tree.viewed", "family", familyId.toString())
    }

    private companion object {
        const val MEMBERS = "/families/{familyId}/members"
        val VIEW_WINDOW: Duration = Duration.ofHours(1)
    }
}
