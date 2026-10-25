package com.github.bff.member

import com.github.bff.auth.CurrentUser
import com.github.bff.auth.Role
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import org.springframework.web.servlet.HandlerMapping
import java.util.UUID

// Admins see every family. Everyone else sees only the first real family, the first without test settings in the
// saved order; other families, test families included, look as if they did not exist.
@Component
class FamilyVisibility(private val familyRepository: FamilyRepository) {
    fun isVisible(familyId: UUID): Boolean = seesAll() || visibleFamilyId() == familyId

    fun <T> filter(families: List<T>, id: (T) -> UUID): List<T> {
        if (seesAll()) return families
        val visible = visibleFamilyId() ?: return emptyList()
        return families.filter { id(it) == visible }
    }

    private fun seesAll() = CurrentUser.current()?.role == Role.ADMIN

    private fun visibleFamilyId() = familyRepository.findFirstByTotalUsersIsNullOrderByPositionAsc()?.id
}

// Answers 404 for every /families/{familyId}/... request to a family the user may not see.
@Component
class FamilyVisibilityInterceptor(private val familyVisibility: FamilyVisibility) : HandlerInterceptor {
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val variables = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE) as? Map<*, *>
        val familyId = (variables?.get("familyId") as? String)?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (familyId == null || familyVisibility.isVisible(familyId)) return true
        response.status = HttpStatus.NOT_FOUND.value()
        return false
    }
}
