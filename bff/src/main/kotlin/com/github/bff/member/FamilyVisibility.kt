package com.github.bff.member

import com.github.bff.auth.CurrentUser
import com.github.bff.auth.Permission
import com.github.bff.auth.Role
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.FamilySummary
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import org.springframework.web.servlet.HandlerMapping
import java.util.UUID
import com.github.bff.generated.model.Permission as ApiPermission
import com.github.bff.generated.model.Role as ApiRole

// The user's role in a family. Admins are admins in every family, test families included, and developers are
// developers in the families they created. Everyone else has the role the access file gives them for the family's
// slug (or, with the app.roles lists, in the first family without test settings); other test families and every
// other family look as if they did not exist.
@Component
class FamilyVisibility(private val familyRepository: FamilyRepository) {
    fun roleIn(familyId: UUID, user: CurrentUser? = CurrentUser.current()): Role? {
        user ?: return null
        if (user.access.admin) return Role.ADMIN
        val family = familyRepository.findById(familyId).orElse(null) ?: return null
        return roleIn(family, user)
    }

    fun isVisible(familyId: UUID): Boolean = roleIn(familyId) != null

    // Whether the user may do this in the family; a family they cannot see is left to FamilyVisibilityInterceptor's 404.
    fun allows(user: CurrentUser, familyId: UUID, permission: Permission): Boolean =
        roleIn(familyId, user)?.let { permission in it.permissions } ?: true

    // The visible families, each with the user's role and permissions in it.
    fun visible(families: List<FamilySummary>): List<FamilySummary> {
        val user = CurrentUser.current() ?: return emptyList()
        val entities = familyRepository.findAllById(families.map { it.id }).associateBy { it.id }
        return families.mapNotNull { family ->
            entities[family.id]?.let { roleIn(it, user) }?.let { family.withRole(it) }
        }
    }

    // One family returned by a write, which only someone with a role in it can make.
    fun withCallerRole(family: FamilySummary): FamilySummary = family.withRole(roleIn(family.id) ?: Role.VISITOR)

    private fun roleIn(family: FamilyEntity, user: CurrentUser): Role? {
        val access = user.access
        return when {
            access.admin -> Role.ADMIN
            access.developer && family.createdBy != null && family.createdBy == user.email.normalizedEmail() -> Role.DEVELOPER
            family.totalUsers != null -> null
            else -> access.families[family.slug] ?: access.firstFamily?.takeIf { family.id == firstFamilyId() }
        }
    }

    private fun firstFamilyId() = familyRepository.findFirstByTotalUsersIsNullOrderByPositionAsc()?.id

    private fun FamilySummary.withRole(role: Role) = apply {
        this.role = ApiRole.fromValue(role.name.lowercase())
        permissions = Permission.entries.filter { it in role.permissions }.map { ApiPermission.fromValue(it.key) }
    }
}

// Answers 404 (NOT_FOUND) for every /families/{familyId}/... request to a family the user may not see.
@Component
class FamilyVisibilityInterceptor(private val familyVisibility: FamilyVisibility) : HandlerInterceptor {
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val variables = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE) as? Map<*, *>
        val familyId = (variables?.get("familyId") as? String)?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (familyId == null || familyVisibility.isVisible(familyId)) return true
        throw ApiProblem(ProblemCode.NOT_FOUND)
    }
}
