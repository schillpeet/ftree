package com.github.bff.problem

import com.github.bff.generated.model.FieldError
import com.github.bff.generated.model.ProblemCode
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ProblemDetail
import java.net.URI

// Thrown by controllers and interceptors; ProblemAdvice answers it as problem details. The generated interfaces return
// typed ResponseEntity<T>, so throwing is the only way to send a problem body from a controller.
class ApiProblem(val code: ProblemCode) : RuntimeException(code.value, null, false, false)

val ProblemCode.status: HttpStatus
    get() = when (this) {
        ProblemCode.VALIDATION_FAILED, ProblemCode.INVALID_REQUEST -> HttpStatus.BAD_REQUEST
        ProblemCode.UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED
        ProblemCode.FORBIDDEN -> HttpStatus.FORBIDDEN
        ProblemCode.NOT_FOUND -> HttpStatus.NOT_FOUND
        ProblemCode.METHOD_NOT_ALLOWED -> HttpStatus.METHOD_NOT_ALLOWED
        ProblemCode.NAME_TAKEN, ProblemCode.PIN_TAKEN -> HttpStatus.CONFLICT
        ProblemCode.PHOTO_TOO_LARGE -> HttpStatus.CONTENT_TOO_LARGE
        ProblemCode.UNSUPPORTED_MEDIA_TYPE -> HttpStatus.UNSUPPORTED_MEDIA_TYPE
        ProblemCode.INTERNAL_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR
    }

// Fixed sentences only: never an exception message, which may name internals or echo the request's data.
private val ProblemCode.detail: String
    get() = when (this) {
        ProblemCode.VALIDATION_FAILED -> "The request does not match the API schema."
        ProblemCode.INVALID_REQUEST -> "The request cannot be carried out."
        ProblemCode.UNAUTHENTICATED -> "A valid sign-in is required."
        ProblemCode.FORBIDDEN -> "You are not allowed to do this."
        ProblemCode.NOT_FOUND -> "The resource does not exist."
        ProblemCode.METHOD_NOT_ALLOWED -> "The resource does not support this method."
        ProblemCode.NAME_TAKEN -> "A family with this name already exists."
        ProblemCode.PIN_TAKEN -> "Another member is already pinned to this place."
        ProblemCode.PHOTO_TOO_LARGE -> "The photo is too large."
        ProblemCode.UNSUPPORTED_MEDIA_TYPE -> "The content type is not supported."
        ProblemCode.INTERNAL_ERROR -> "An unexpected error occurred."
    }

// The code for a status that Spring itself answers, for example 405 or a body it cannot read.
fun problemCodeOf(status: Int): ProblemCode = when (status) {
    400 -> ProblemCode.VALIDATION_FAILED
    401 -> ProblemCode.UNAUTHENTICATED
    403 -> ProblemCode.FORBIDDEN
    404 -> ProblemCode.NOT_FOUND
    405 -> ProblemCode.METHOD_NOT_ALLOWED
    413 -> ProblemCode.PHOTO_TOO_LARGE
    415 -> ProblemCode.UNSUPPORTED_MEDIA_TYPE
    in 400..499 -> ProblemCode.INVALID_REQUEST
    else -> ProblemCode.INTERNAL_ERROR
}

// `status` differs from the code's only for statuses Spring answers that have no code of their own, such as 406.
fun problemDetail(
    code: ProblemCode,
    path: String,
    errors: List<FieldError> = emptyList(),
    status: HttpStatusCode = code.status,
): ProblemDetail =
    ProblemDetail.forStatusAndDetail(status, code.detail).apply {
        type = URI.create("urn:ftree:problem:" + code.name.lowercase().replace('_', '-'))
        instance = runCatching { URI.create(path) }.getOrNull()
        setProperty("code", code.value)
        if (errors.isNotEmpty()) setProperty("errors", errors.map { mapOf("field" to it.field, "message" to it.message) })
    }
