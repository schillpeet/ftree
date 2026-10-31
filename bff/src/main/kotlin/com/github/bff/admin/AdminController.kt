package com.github.bff.admin

import com.github.bff.generated.api.AdminApi
import com.github.bff.generated.model.AdminFamily
import com.github.bff.generated.model.AdminOverview
import com.github.bff.generated.model.AdminPresence
import com.github.bff.generated.model.AuditCategory
import com.github.bff.generated.model.AuditFilters
import com.github.bff.generated.model.AuditPage
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.time.OffsetDateTime
import java.util.UUID

// SecurityConfiguration requires users.view for every path here.
@RestController
class AdminController(private val service: AdminOverviewService, private val audit: AuditLogService) : AdminApi {
    override fun getAdminOverview(): ResponseEntity<AdminOverview> = ResponseEntity.ok(service.overview())

    override fun getAdminPresence(): ResponseEntity<List<AdminPresence>> = ResponseEntity.ok(service.presence())

    override fun getAdminFamilies(): ResponseEntity<List<AdminFamily>> = ResponseEntity.ok(service.families())

    override fun getAdminAudit(
        limit: Int,
        before: Long?,
        userId: UUID?,
        familyId: UUID?,
        action: String?,
        category: AuditCategory?,
        from: OffsetDateTime?,
        to: OffsetDateTime?,
    ): ResponseEntity<AuditPage> =
        // Spring does not check the generated bounds on an overriding method.
        if (limit !in 1..100 || (before ?: 1) < 1 || (action?.length ?: 0) > 60) throw ApiProblem(ProblemCode.INVALID_REQUEST)
        else ResponseEntity.ok(audit.page(limit, before, userId, familyId, action, category, from, to))

    override fun getAdminAuditFilters(): ResponseEntity<AuditFilters> = ResponseEntity.ok(audit.filters())
}
