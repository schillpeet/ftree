package com.github.bff.member

import com.github.bff.generated.api.FamiliesApi
import com.github.bff.generated.model.AnonymizeFamilyRequest
import com.github.bff.generated.model.ArchiveFamilyRequest
import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.FamilySummary
import com.github.bff.generated.model.ImportFamilyRequest
import com.github.bff.generated.model.RenameFamilyRequest
import com.github.bff.generated.model.ReorderFamiliesRequest
import com.github.bff.generated.model.SetFamilyPhotoFitRequest
import jakarta.servlet.http.HttpServletRequest
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.Resource
import org.springframework.http.CacheControl
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.util.UUID

@RestController
class FamiliesController(
    private val familyService: FamilyService,
    private val familyVisibility: FamilyVisibility,
    // Request-scoped proxy; the generated interface does not pass the body's Content-Type.
    private val request: HttpServletRequest,
) : FamiliesApi {
    override fun getFamilies(): ResponseEntity<List<FamilySummary>> =
        ResponseEntity.ok(familyVisibility.filter(familyService.findAll()) { it.id })

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

    override fun anonymizeFamily(familyId: UUID, anonymizeFamilyRequest: AnonymizeFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.anonymize(familyId, anonymizeFamilyRequest)) {
            is FamilyAnonymizeResult.ANONYMIZED -> ResponseEntity.status(HttpStatus.CREATED).body(result.summary)
            FamilyAnonymizeResult.INVALID -> ResponseEntity.badRequest().build()
            FamilyAnonymizeResult.NOT_FOUND -> ResponseEntity.notFound().build()
            FamilyAnonymizeResult.NAME_TAKEN -> ResponseEntity.status(HttpStatus.CONFLICT).build()
        }

    override fun importFamily(importFamilyRequest: ImportFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.import(importFamilyRequest)) {
            is FamilyImportResult.IMPORTED -> ResponseEntity.status(HttpStatus.CREATED).body(result.summary)
            FamilyImportResult.INVALID -> ResponseEntity.badRequest().build()
            FamilyImportResult.NAME_TAKEN -> ResponseEntity.status(HttpStatus.CONFLICT).build()
        }

    override fun exportFamily(familyId: UUID): ResponseEntity<String> {
        val export = familyService.export(familyId) ?: return ResponseEntity.notFound().build()
        val fileName = export.name.replace(UNSAFE_FILE_NAME_CHARS, "_") + ".ged"
        return ResponseEntity.ok()
            .contentType(MediaType("text", "plain", Charsets.UTF_8))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName, Charsets.UTF_8).build().toString())
            .body(export.gedcom)
    }

    override fun reorderFamilies(reorderFamiliesRequest: ReorderFamiliesRequest): ResponseEntity<Void> =
        if (familyService.reorder(reorderFamiliesRequest)) ResponseEntity.noContent().build() else ResponseEntity.badRequest().build()

    override fun deleteFamily(familyId: UUID): ResponseEntity<Void> =
        if (familyService.delete(familyId)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()

    override fun uploadFamilyPhoto(familyId: UUID, body: Resource): ResponseEntity<Void> =
        when (familyService.updatePhoto(familyId, request.contentType, body.contentAsByteArray)) {
            PhotoResult.UPDATED -> ResponseEntity.noContent().build()
            PhotoResult.INVALID -> ResponseEntity.badRequest().build()
            PhotoResult.NOT_FOUND -> ResponseEntity.notFound().build()
            PhotoResult.TOO_LARGE -> ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).build()
            PhotoResult.UNSUPPORTED_TYPE -> ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).build()
        }

    override fun getFamilyPhoto(familyId: UUID): ResponseEntity<Resource> =
        familyService.findPhoto(familyId)?.let { photo ->
            ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .body<Resource>(ByteArrayResource(photo.data))
        } ?: ResponseEntity.notFound().build()

    override fun deleteFamilyPhoto(familyId: UUID): ResponseEntity<Void> =
        if (familyService.deletePhoto(familyId)) ResponseEntity.noContent().build() else ResponseEntity.notFound().build()

    override fun setFamilyPhotoFit(familyId: UUID, setFamilyPhotoFitRequest: SetFamilyPhotoFitRequest): ResponseEntity<FamilySummary> =
        familyService.setPhotoFit(familyId, setFamilyPhotoFitRequest.photoFit)?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()

    override fun renameFamily(familyId: UUID, renameFamilyRequest: RenameFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.rename(familyId, renameFamilyRequest)) {
            is FamilyRenameResult.RENAMED -> ResponseEntity.ok(result.summary)
            FamilyRenameResult.INVALID -> ResponseEntity.badRequest().build()
            FamilyRenameResult.NOT_FOUND -> ResponseEntity.notFound().build()
            FamilyRenameResult.NAME_TAKEN -> ResponseEntity.status(HttpStatus.CONFLICT).build()
        }
}

private val UNSAFE_FILE_NAME_CHARS = Regex("""[\\/:*?"<>|\p{Cntrl}]""")
