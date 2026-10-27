package com.github.bff.auth.access

import com.github.bff.auth.AuditLog
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import java.util.UUID

// Ends someone's Cloudflare Access sessions on an admin's request; their rights stay. Written to the audit log once
// Cloudflare confirmed it.
@Service
class AccessSessions(private val jdbc: JdbcTemplate, private val gateway: AccessGateway, private val auditLog: AuditLog) {
    fun revoke(userId: UUID, actor: String) {
        val email = jdbc.query("SELECT email FROM users WHERE id = ?", { rs, _ -> rs.getString(1) }, userId).singleOrNull()
            ?: throw ApiProblem(ProblemCode.NOT_FOUND)
        try {
            gateway.revokeSessions(email)
        } catch (exception: AccessGatewayException) {
            log.warn("Ending Access sessions failed: {}", exception.message)
            throw ApiProblem(ProblemCode.ACCESS_UNAVAILABLE)
        }
        auditLog.record(actor, "user.sessions.revoked", "user", email)
    }

    private companion object {
        val log = LoggerFactory.getLogger(AccessSessions::class.java)
    }
}
