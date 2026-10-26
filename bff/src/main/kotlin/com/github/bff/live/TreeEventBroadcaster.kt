package com.github.bff.live

import com.github.bff.auth.CurrentUser
import com.github.bff.auth.Permission
import com.github.bff.generated.model.FamilyEvent
import com.github.bff.generated.model.MemberEvent
import com.github.bff.generated.model.PresenceEvent
import com.github.bff.generated.model.PresentClient
import com.github.bff.member.FamilyVisibility
import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionalEventListener
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.time.Duration
import java.util.UUID
import java.util.concurrent.CopyOnWriteArraySet

// Holds the open event streams of every family and sends them presence and saved changes. Like PresenceRegistry it
// works only while the BFF runs as a single replica.
@Component
class TreeEventBroadcaster(
    private val presence: PresenceRegistry,
    private val familyVisibility: FamilyVisibility,
) {
    private class Stream(val familyId: UUID, val user: CurrentUser, val clientId: String, val emitter: SseEmitter) {
        // Whether closing the stream takes the client out of the presence; a stream that merely timed out is
        // reopened by EventSource right away, so its client stays until PresenceRegistry.TIMEOUT.
        @Volatile
        var leaves = true
    }

    private val streams = CopyOnWriteArraySet<Stream>()

    // Opens a stream for the client, adds it to the presence, and sends the presence to the whole family.
    fun subscribe(familyId: UUID, user: CurrentUser, clientId: String): SseEmitter {
        val stream = Stream(familyId, user, clientId, SseEmitter(MAX_STREAM_DURATION.toMillis()))
        stream.emitter.onTimeout {
            stream.leaves = false
            stream.emitter.complete()
        }
        stream.emitter.onCompletion { closed(stream) }
        stream.emitter.onError { closed(stream) }
        streams += stream
        presence.join(familyId, clientId, user.email, user.access.admin)
        sendPresence(familyId)
        return stream.emitter
    }

    fun sendPresence(familyId: UUID) {
        val present = presence.inFamily(familyId).map {
            PresentClient(it.clientId, it.email, initialsOf(it.email), it.admin, it.idle).viewing(it.viewing).editing(it.editing)
        }
        send(familyId, "presence", PresenceEvent(present))
    }

    @TransactionalEventListener
    fun on(event: TreeEvent) {
        when (event) {
            is TreeEvent.MemberChanged -> send(event.familyId, "member-changed", MemberEvent(event.memberId, event.by))
            is TreeEvent.MemberDeleted -> send(event.familyId, "member-deleted", MemberEvent(event.memberId, event.by))
            is TreeEvent.FamilyChanged -> send(event.familyId, "family-changed", FamilyEvent(event.familyId, event.by))
            is TreeEvent.FamilyDeleted -> {
                send(event.familyId, "family-changed", FamilyEvent(event.familyId, event.by))
                streams.filter { it.familyId == event.familyId }.forEach { end(it, leaves = false) }
                presence.clear(event.familyId)
            }
        }
    }

    // A comment keeps proxies from closing idle streams and finds the ones whose browser has gone. Streams of users
    // who lost access to the family end, so they get the 404 when EventSource reconnects.
    @Scheduled(fixedRateString = "\${app.live.heartbeat:20s}", initialDelayString = "\${app.live.heartbeat:20s}")
    fun heartbeat() {
        streams.forEach { stream ->
            val allowed = runCatching { familyVisibility.roleIn(stream.familyId, stream.user) }.getOrNull()
                ?.let { Permission.TREE_VIEW in it.permissions } ?: false
            if (allowed) deliver(stream, SseEmitter.event().comment("heartbeat")) else end(stream, leaves = true)
        }
    }

    // Takes out the clients that stopped sending presence and tells their families.
    @Scheduled(fixedRateString = "\${app.live.expiry-check:5s}")
    fun expire() {
        presence.expire().forEach(::sendPresence)
    }

    @PreDestroy
    fun closeAll() {
        streams.forEach { end(it, leaves = false) }
    }

    private fun end(stream: Stream, leaves: Boolean) {
        stream.leaves = leaves
        runCatching { stream.emitter.complete() }
        closed(stream)
    }

    private fun closed(stream: Stream) {
        if (!streams.remove(stream) || !stream.leaves) return
        // A reconnected tab may already have a new stream with the same client id.
        val reopened = streams.any { it.familyId == stream.familyId && it.clientId == stream.clientId && it.user.email == stream.user.email }
        if (!reopened && presence.leave(stream.familyId, stream.clientId, stream.user.email)) sendPresence(stream.familyId)
    }

    // A new builder per stream: building one appends to it, so it cannot be sent twice.
    private fun send(familyId: UUID, name: String, data: Any) {
        streams.filter { it.familyId == familyId }.forEach { deliver(it, SseEmitter.event().name(name).data(data, MediaType.APPLICATION_JSON)) }
    }

    private fun deliver(stream: Stream, event: SseEmitter.SseEventBuilder) {
        try {
            stream.emitter.send(event)
        } catch (exception: Exception) {
            // The browser has gone.
            log.debug("Closing an event stream that could not be written", exception)
            runCatching { stream.emitter.completeWithError(exception) }
            closed(stream)
        }
    }

    companion object {
        // Ends every stream after this long, so EventSource reconnects and the sign-in is checked again.
        val MAX_STREAM_DURATION: Duration = Duration.ofMinutes(30)
        private val log = LoggerFactory.getLogger(TreeEventBroadcaster::class.java)
    }
}
