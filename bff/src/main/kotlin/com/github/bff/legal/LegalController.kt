package com.github.bff.legal

import com.github.bff.auth.CurrentUser
import com.github.bff.auth.MeResponses
import com.github.bff.generated.api.LegalApi
import com.github.bff.generated.model.AcceptLegalDocumentsRequest
import com.github.bff.generated.model.LegalAcceptance
import com.github.bff.generated.model.LegalDocument
import com.github.bff.generated.model.LegalKind
import com.github.bff.generated.model.Me
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import org.springframework.context.annotation.Configuration
import org.springframework.format.FormatterRegistry
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.util.UUID

@RestController
class LegalController(private val legal: LegalService, private val meResponses: MeResponses) : LegalApi {
    override fun getLegalDocument(kind: LegalKind, version: Int?): ResponseEntity<LegalDocument> =
        ResponseEntity.ok(legal.document(kind, version) ?: throw ApiProblem(ProblemCode.NOT_FOUND))

    override fun listMyLegalAcceptances(): ResponseEntity<List<LegalAcceptance>> =
        ResponseEntity.ok(legal.acceptancesOf(user().email))

    override fun acceptLegalDocuments(acceptLegalDocumentsRequest: AcceptLegalDocumentsRequest): ResponseEntity<Me> {
        val user = user()
        legal.accept(user.email, acceptLegalDocumentsRequest.documents, acceptLegalDocumentsRequest.language)
        return ResponseEntity.ok(meResponses.of(user))
    }

    override fun getAdminUserLegalAcceptances(userId: UUID): ResponseEntity<List<LegalAcceptance>> =
        ResponseEntity.ok(legal.acceptancesOf(userId) ?: throw ApiProblem(ProblemCode.NOT_FOUND))

    private fun user() = CurrentUser.current() ?: throw ApiProblem(ProblemCode.UNAUTHENTICATED)
}

// Reads `kind` in a path by its API value (`terms`), not the enum constant's name; an unknown value answers 400.
@Configuration
class LegalKindConverter : WebMvcConfigurer {
    override fun addFormatters(registry: FormatterRegistry) {
        registry.addConverter(String::class.java, LegalKind::class.java, LegalKind::fromValue)
    }
}
