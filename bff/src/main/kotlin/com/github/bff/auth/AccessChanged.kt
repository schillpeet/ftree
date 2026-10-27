package com.github.bff.auth

import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID

// Someone's rights changed: a role in the tree familyId, or a global right when familyId is null. Listeners, such as a
// later sync of the Cloudflare Access group, read the person's rights again; the event only says whose changed.
data class AccessChanged(val email: String, val familyId: UUID?)

// Publishes AccessChanged once the transaction commits, so listeners never see a change that is rolled back; outside
// a transaction it publishes right away.
@Component
class AccessEvents(private val events: ApplicationEventPublisher) {
    fun changed(email: String, familyId: UUID?) {
        val event = AccessChanged(email.normalizedEmail(), familyId)
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return events.publishEvent(event)
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                override fun afterCommit() = events.publishEvent(event)
            },
        )
    }
}
