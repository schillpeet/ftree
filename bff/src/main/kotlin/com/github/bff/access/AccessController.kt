package com.github.bff.access

import com.github.bff.auth.CurrentUser
import com.github.bff.auth.access.AccessSessions
import com.github.bff.generated.api.AccessApi
import com.github.bff.generated.model.AdminInvitation
import com.github.bff.generated.model.AdminUser
import com.github.bff.generated.model.ProblemCode
import com.github.bff.generated.model.ShareTreeRequest
import com.github.bff.generated.model.TransferOwnershipRequest
import com.github.bff.generated.model.TreeAccessEntry
import com.github.bff.generated.model.TreeInvitation
import com.github.bff.generated.model.UpdateAdminUserRequest
import com.github.bff.problem.ApiProblem
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

// SecurityConfiguration requires family.share in the tree for /families/{familyId}/..., users.view to read the
// /admin paths, and users.manage to change a person or end their sessions.
@RestController
class AccessController(
    private val trees: TreeAccessService,
    private val people: PeopleService,
    private val sessions: AccessSessions,
) : AccessApi {
    override fun getTreeAccess(familyId: UUID): ResponseEntity<List<TreeAccessEntry>> = ResponseEntity.ok(trees.list(familyId))

    override fun shareTree(familyId: UUID, shareTreeRequest: ShareTreeRequest, acceptLanguage: String?): ResponseEntity<TreeInvitation> =
        ResponseEntity.ok(trees.share(familyId, shareTreeRequest.email, shareTreeRequest.role, actor(), acceptLanguage))

    override fun revokeTreeAccess(familyId: UUID, userId: UUID): ResponseEntity<Void> {
        trees.revoke(familyId, userId, actor())
        return ResponseEntity.noContent().build()
    }

    override fun transferTreeOwnership(familyId: UUID, transferOwnershipRequest: TransferOwnershipRequest): ResponseEntity<Void> {
        trees.transfer(familyId, transferOwnershipRequest.userId, actor())
        return ResponseEntity.noContent().build()
    }

    override fun getAdminUsers(): ResponseEntity<List<AdminUser>> = ResponseEntity.ok(people.users())

    override fun updateAdminUser(userId: UUID, updateAdminUserRequest: UpdateAdminUserRequest): ResponseEntity<AdminUser> =
        ResponseEntity.ok(people.update(userId, updateAdminUserRequest, actor()))

    override fun revokeAdminUserSessions(userId: UUID): ResponseEntity<Void> {
        sessions.revoke(userId, actor())
        return ResponseEntity.noContent().build()
    }

    override fun getAdminInvitations(): ResponseEntity<List<AdminInvitation>> = ResponseEntity.ok(people.invitations())

    private fun actor() = CurrentUser.current()?.email ?: throw ApiProblem(ProblemCode.UNAUTHENTICATED)
}
