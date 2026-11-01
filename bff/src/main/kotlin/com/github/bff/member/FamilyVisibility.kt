package com.github.bff.member

import com.github.bff.auth.AccessPolicy
import com.github.bff.auth.CurrentUser
import com.github.bff.auth.Permission
import com.github.bff.auth.Role
import com.github.bff.auth.SelfMembers
import com.github.bff.generated.model.FamilySummary
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import jakarta.servlet.DispatcherType
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import org.springframework.web.servlet.HandlerMapping
import java.util.UUID
import com.github.bff.generated.model.Permission as ApiPermission
import com.github.bff.generated.model.Role as ApiRole

// The user's role in a family. Admins are admins in every family, test families included; everyone else has the role
// of their membership in the database, and only owners reach test families. Every other family looks as if it did not
// exist.
@Component
class FamilyVisibility(
    private val familyRepository: FamilyRepository,
    private val accessPolicy: AccessPolicy,
    private val selfMembers: SelfMembers,
) {
    fun roleIn(familyId: UUID, user: CurrentUser? = CurrentUser.current()): Role? {
        user ?: return null
        val family = familyRepository.findById(familyId).orElse(null) ?: return null
        return roleIn(family, user)
    }

    fun isVisible(familyId: UUID): Boolean = roleIn(familyId) != null

    fun isVisible(family: FamilyEntity): Boolean = CurrentUser.current()?.let { roleIn(family, it) } != null

    // Whether the user may do this in the family; a family they cannot see is left to FamilyVisibilityInterceptor's 404.
    fun allows(user: CurrentUser, familyId: UUID, permission: Permission): Boolean =
        roleIn(familyId, user)?.let { permission in it.permissions } ?: true

    // The visible families, each with the user's role and permissions in it and the member they are.
    fun visible(families: List<FamilySummary>): List<FamilySummary> {
        val user = CurrentUser.current() ?: return emptyList()
        val entities = familyRepository.findAllById(families.map { it.id }).associateBy { it.id }
        val self = selfMembers.of(user.email)
        return families.mapNotNull { family ->
            entities[family.id]?.let { roleIn(it, user) }?.let { family.withRole(it, self[family.id]) }
        }
    }

    // One family returned by a write, which only someone with a role in it can make. The access is read again, since the
    // owner membership of a family created in this request is newer than the user's access.
    fun withCallerRole(family: FamilySummary): FamilySummary {
        val user = CurrentUser.current()?.let { it.copy(access = accessPolicy.accessOf(it.email, it.adminSession)) }
        return family.withRole(roleIn(family.id, user) ?: Role.VISITOR, user?.let { selfMembers.of(it.email)[family.id] })
    }

    private fun roleIn(family: FamilyEntity, user: CurrentUser): Role? {
        // A trashed family is invisible to everyone, admins included; only the trash endpoints reach it.
        if (family.deletedAt != null) return null
        val access = user.access
        if (access.admin) return Role.ADMIN
        val role = access.memberships[family.id]
        return role?.takeIf { family.totalUsers == null || it == Role.OWNER }
    }

    private fun FamilySummary.withRole(role: Role, selfMemberId: UUID?) = apply {
        this.role = ApiRole.fromValue(role.name.lowercase())
        permissions = Permission.entries.filter { it in role.permissions }.map { ApiPermission.fromValue(it.key) }
        this.selfMemberId = selfMemberId
    }
}

// Answers 404 (NOT_FOUND) for every /families/{familyId}/... request to a family the user may not see. The async
// dispatch that ends an event stream has no user and was checked when the stream opened.
@Component
class FamilyVisibilityInterceptor(private val familyVisibility: FamilyVisibility) : HandlerInterceptor {
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        if (request.dispatcherType == DispatcherType.ASYNC) return true
        val variables = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE) as? Map<*, *>
        val familyId = (variables?.get("familyId") as? String)?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (familyId == null || familyVisibility.isVisible(familyId)) return true
        throw ApiProblem(ProblemCode.NOT_FOUND)
    }
}
