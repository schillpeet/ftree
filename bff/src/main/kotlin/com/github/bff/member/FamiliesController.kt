package com.github.bff.member

import com.github.bff.generated.api.FamiliesApi
import com.github.bff.generated.model.ArchiveFamilyRequest
import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.FamilySummary
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
class FamiliesController(private val familyService: FamilyService) : FamiliesApi {
    override fun getFamilies(): ResponseEntity<List<FamilySummary>> = ResponseEntity.ok(familyService.findAll())

    override fun createFamily(createFamilyRequest: CreateFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.create(createFamilyRequest)) {
            is FamilyCreationResult.CREATED -> ResponseEntity.status(HttpStatus.CREATED).body(result.summary)
            FamilyCreationResult.INVALID -> ResponseEntity.badRequest().build()
            FamilyCreationResult.NAME_TAKEN -> ResponseEntity.status(HttpStatus.CONFLICT).build()
        }

    override fun archiveFamily(familyId: UUID, archiveFamilyRequest: ArchiveFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.archive(familyId, archiveFamilyRequest)) {
            is FamilyArchiveResult.ARCHIVED -> ResponseEntity.status(HttpStatus.CREATED).body(result.summary)
            FamilyArchiveResult.INVALID -> ResponseEntity.badRequest().build()
            FamilyArchiveResult.NOT_FOUND -> ResponseEntity.notFound().build()
            FamilyArchiveResult.NAME_TAKEN -> ResponseEntity.status(HttpStatus.CONFLICT).build()
        }

    override fun deleteFamily(familyId: UUID): ResponseEntity<Void> =
        if (familyService.delete(familyId)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()
}
