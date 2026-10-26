package com.github.bff.member

import com.github.bff.generated.api.TrashApi
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.TrashedFamily
import com.github.bff.problem.ApiProblem
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
class TrashController(private val trash: TrashService) : TrashApi {
    override fun getTrash(): ResponseEntity<List<TrashedFamily>> = ResponseEntity.ok(trash.list())

    override fun restoreTrashedFamily(familyId: UUID): ResponseEntity<Void> =
        if (trash.restore(familyId)) ResponseEntity.noContent().build() else throw ApiProblem(ProblemCode.NOT_FOUND)

    override fun purgeTrashedFamily(familyId: UUID): ResponseEntity<Void> =
        if (trash.purge(familyId)) ResponseEntity.noContent().build() else throw ApiProblem(ProblemCode.NOT_FOUND)
}
