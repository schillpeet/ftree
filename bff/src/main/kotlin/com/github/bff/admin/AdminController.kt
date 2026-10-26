package com.github.bff.admin

import com.github.bff.generated.api.AdminApi
import com.github.bff.generated.model.AdminFamily
import com.github.bff.generated.model.AdminOverview
import com.github.bff.generated.model.AdminPresence
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

// SecurityConfiguration requires users.view for every path here.
@RestController
class AdminController(private val service: AdminOverviewService) : AdminApi {
    override fun getAdminOverview(): ResponseEntity<AdminOverview> = ResponseEntity.ok(service.overview())

    override fun getAdminPresence(): ResponseEntity<List<AdminPresence>> = ResponseEntity.ok(service.presence())

    override fun getAdminFamilies(): ResponseEntity<List<AdminFamily>> = ResponseEntity.ok(service.families())
}
