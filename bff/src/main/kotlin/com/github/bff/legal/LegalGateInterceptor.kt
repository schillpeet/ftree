package com.github.bff.legal

import com.github.bff.auth.CurrentUser
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import jakarta.servlet.DispatcherType
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor

// With an open legal document every call of a signed-in person answers 403 LEGAL_ACCEPTANCE_REQUIRED, except what they need
// to read and accept it. It asks no role, so it holds for admins and on the admin host as well. Security has already
// refused what the person may not do at all, so this reveals nothing new.
@Component
class LegalGateInterceptor(private val open: OpenLegalDocuments) : HandlerInterceptor {
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        // An event stream ends with an async dispatch of the request that already passed.
        if (request.dispatcherType != DispatcherType.REQUEST || isExempt(request.method, request.requestURI)) return true
        val user = CurrentUser.current() ?: return true
        if (open.anyOpenFor(user.email)) throw ApiProblem(ProblemCode.LEGAL_ACCEPTANCE_REQUIRED)
        return true
    }

    private fun isExempt(method: String, path: String) =
        (method == "GET" && (path == "/me" || path.startsWith("/legal/"))) || (method == "POST" && path == "/me/legal-acceptances")
}
