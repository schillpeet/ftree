package com.github.bff.problem

import com.github.bff.generated.model.FieldError
import com.github.bff.generated.model.ProblemCode
import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatusCode
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.AuthenticationException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.ServletWebRequest
import org.springframework.web.context.request.WebRequest
import org.springframework.web.servlet.HandlerMapping
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

// Answers every error as RFC 9457 problem details with a code. SecurityConfiguration routes the 401 and 403 of its
// filters here as well, so there is one place for the shape.
@RestControllerAdvice
class ProblemAdvice : ResponseEntityExceptionHandler() {
    @ExceptionHandler(ApiProblem::class)
    fun handleApiProblem(exception: ApiProblem, request: HttpServletRequest) = answer(exception.code, request)

    @ExceptionHandler(AuthenticationException::class)
    fun handleAuthentication(request: HttpServletRequest) = answer(ProblemCode.UNAUTHENTICATED, request)

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied(request: HttpServletRequest) = answer(ProblemCode.FORBIDDEN, request)

    // The message and the stack trace stay in the log, which must not name people, so only the type and place are logged.
    @ExceptionHandler(Exception::class)
    fun handleUnexpected(exception: Exception, request: HttpServletRequest): ResponseEntity<ProblemDetail> {
        log.error(
            "Unhandled {} at {} for {} {}",
            exception.javaClass.name,
            exception.stackTrace.firstOrNull(),
            request.method,
            request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE) ?: "an unmatched path",
        )
        return answer(ProblemCode.INTERNAL_ERROR, request)
    }

    // Everything Spring MVC answers itself (unreadable JSON, failed validation, 405, 415, ...). Its own details may
    // quote the parser or the rejected value, so they are replaced.
    override fun handleExceptionInternal(
        ex: Exception,
        body: Any?,
        headers: HttpHeaders,
        statusCode: HttpStatusCode,
        request: WebRequest,
    ): ResponseEntity<Any>? {
        val errors = (ex as? MethodArgumentNotValidException)?.bindingResult?.fieldErrors.orEmpty()
            .map { FieldError(it.field, it.defaultMessage ?: "is invalid") }
        val path = (request as? ServletWebRequest)?.request?.requestURI ?: ""
        val problem = problemDetail(problemCodeOf(statusCode.value()), path, errors, statusCode)
        return ResponseEntity.status(statusCode).headers(headers).body(problem)
    }

    private fun answer(code: ProblemCode, request: HttpServletRequest) =
        ResponseEntity.status(code.status).body(problemDetail(code, request.requestURI))

    private companion object {
        val log = LoggerFactory.getLogger(ProblemAdvice::class.java)
    }
}
