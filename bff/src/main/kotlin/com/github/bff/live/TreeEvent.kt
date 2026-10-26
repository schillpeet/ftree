package com.github.bff.live

import com.github.bff.auth.CurrentUser
import com.github.bff.auth.normalizedEmail
import java.util.UUID

// A saved change in one family. The services publish it inside their transaction, and TreeEventBroadcaster sends it to
// the family's streams once the transaction has committed. by is whoever made the change.
sealed interface TreeEvent {
    val familyId: UUID
    val by: String

    data class MemberChanged(override val familyId: UUID, val memberId: UUID, override val by: String = actor()) : TreeEvent

    data class MemberDeleted(override val familyId: UUID, val memberId: UUID, override val by: String = actor()) : TreeEvent

    data class FamilyChanged(override val familyId: UUID, override val by: String = actor()) : TreeEvent

    // Sent to the streams as family-changed, after which they end.
    data class FamilyDeleted(override val familyId: UUID, override val by: String = actor()) : TreeEvent
}

private fun actor() = CurrentUser.current()?.email?.normalizedEmail().orEmpty()
