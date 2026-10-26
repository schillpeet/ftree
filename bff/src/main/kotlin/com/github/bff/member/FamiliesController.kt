package com.github.bff.member

import com.github.bff.generated.api.FamiliesApi
import com.github.bff.generated.model.AnonymizeFamilyRequest
import com.github.bff.generated.model.ArchiveFamilyRequest
import com.github.bff.generated.model.CreateEmptyFamilyRequest
import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.FamilySummary
import com.github.bff.generated.model.ImportFamilyRequest
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.RenameFamilyRequest
import com.github.bff.generated.model.ReorderFamiliesRequest
import com.github.bff.generated.model.SetFamilyPhotoFitRequest
import com.github.bff.problem.ApiProblem
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
    private val trash: TrashService,
    // Request-scoped proxy; the generated interface does not pass the body's Content-Type.
    private val request: HttpServletRequest,
) : FamiliesApi {
    override fun getFamilies(): ResponseEntity<List<FamilySummary>> =
        ResponseEntity.ok(familyVisibility.visible(familyService.findAll()))

    override fun createFamily(createFamilyRequest: CreateFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.create(createFamilyRequest)) {
            is FamilyCreationResult.CREATED -> ResponseEntity.status(HttpStatus.CREATED).body(familyVisibility.withCallerRole(result.summary))
            FamilyCreationResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            FamilyCreationResult.NAME_TAKEN -> throw trash.nameTaken(createFamilyRequest.name)
        }

    override fun createEmptyFamily(createEmptyFamilyRequest: CreateEmptyFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.createEmpty(createEmptyFamilyRequest)) {
            is FamilyCreationResult.CREATED -> ResponseEntity.status(HttpStatus.CREATED).body(familyVisibility.withCallerRole(result.summary))
            FamilyCreationResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            FamilyCreationResult.NAME_TAKEN -> throw trash.nameTaken(createEmptyFamilyRequest.name)
        }

    override fun archiveFamily(familyId: UUID, archiveFamilyRequest: ArchiveFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.archive(familyId, archiveFamilyRequest)) {
            is FamilyArchiveResult.ARCHIVED -> ResponseEntity.status(HttpStatus.CREATED).body(familyVisibility.withCallerRole(result.summary))
            FamilyArchiveResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            FamilyArchiveResult.NOT_FOUND -> throw ApiProblem(ProblemCode.NOT_FOUND)
            FamilyArchiveResult.NAME_TAKEN -> throw trash.nameTaken(archiveFamilyRequest.name)
        }

    override fun anonymizeFamily(familyId: UUID, anonymizeFamilyRequest: AnonymizeFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.anonymize(familyId, anonymizeFamilyRequest)) {
            is FamilyAnonymizeResult.ANONYMIZED -> ResponseEntity.status(HttpStatus.CREATED).body(familyVisibility.withCallerRole(result.summary))
            FamilyAnonymizeResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            FamilyAnonymizeResult.NOT_FOUND -> throw ApiProblem(ProblemCode.NOT_FOUND)
            FamilyAnonymizeResult.NAME_TAKEN -> throw trash.nameTaken(anonymizeFamilyRequest.name)
        }

    override fun importFamily(importFamilyRequest: ImportFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.import(importFamilyRequest)) {
            is FamilyImportResult.IMPORTED -> ResponseEntity.status(HttpStatus.CREATED).body(familyVisibility.withCallerRole(result.summary))
            FamilyImportResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            FamilyImportResult.NAME_TAKEN -> throw trash.nameTaken(importFamilyRequest.name)
        }

    override fun exportFamily(familyId: UUID): ResponseEntity<String> {
        val export = familyService.export(familyId) ?: throw ApiProblem(ProblemCode.NOT_FOUND)
        val fileName = export.name.replace(UNSAFE_FILE_NAME_CHARS, "_") + ".ged"
        return ResponseEntity.ok()
            .contentType(MediaType("text", "plain", Charsets.UTF_8))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName, Charsets.UTF_8).build().toString())
            .body(export.gedcom)
    }

    override fun reorderFamilies(reorderFamiliesRequest: ReorderFamiliesRequest): ResponseEntity<Void> =
        if (familyService.reorder(reorderFamiliesRequest)) ResponseEntity.noContent().build() else throw ApiProblem(ProblemCode.INVALID_REQUEST)

    override fun deleteFamily(familyId: UUID): ResponseEntity<Void> =
        if (trash.trash(familyId)) ResponseEntity.noContent().build() else throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun uploadFamilyPhoto(familyId: UUID, body: Resource): ResponseEntity<Void> =
        when (familyService.updatePhoto(familyId, request.contentType, body.contentAsByteArray)) {
            PhotoResult.UPDATED -> ResponseEntity.noContent().build()
            PhotoResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            PhotoResult.NOT_FOUND -> throw ApiProblem(ProblemCode.NOT_FOUND)
            PhotoResult.TOO_LARGE -> throw ApiProblem(ProblemCode.PHOTO_TOO_LARGE)
            PhotoResult.UNSUPPORTED_TYPE -> throw ApiProblem(ProblemCode.UNSUPPORTED_MEDIA_TYPE)
        }

    override fun getFamilyPhoto(familyId: UUID): ResponseEntity<Resource> =
        familyService.findPhoto(familyId)?.let { photo ->
            ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .body<Resource>(ByteArrayResource(photo.data))
        } ?: throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun deleteFamilyPhoto(familyId: UUID): ResponseEntity<Void> =
        if (familyService.deletePhoto(familyId)) ResponseEntity.noContent().build() else throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun setFamilyPhotoFit(familyId: UUID, setFamilyPhotoFitRequest: SetFamilyPhotoFitRequest): ResponseEntity<FamilySummary> =
        familyService.setPhotoFit(familyId, setFamilyPhotoFitRequest.photoFit)?.let { ResponseEntity.ok(familyVisibility.withCallerRole(it)) } ?: throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun renameFamily(familyId: UUID, renameFamilyRequest: RenameFamilyRequest): ResponseEntity<FamilySummary> =
        when (val result = familyService.rename(familyId, renameFamilyRequest)) {
            is FamilyRenameResult.RENAMED -> ResponseEntity.ok(familyVisibility.withCallerRole(result.summary))
            FamilyRenameResult.INVALID -> throw ApiProblem(ProblemCode.INVALID_REQUEST)
            FamilyRenameResult.NOT_FOUND -> throw ApiProblem(ProblemCode.NOT_FOUND)
            FamilyRenameResult.NAME_TAKEN -> throw trash.nameTaken(renameFamilyRequest.name)
        }
}

private val UNSAFE_FILE_NAME_CHARS = Regex("""[\\/:*?"<>|\p{Cntrl}]""")
