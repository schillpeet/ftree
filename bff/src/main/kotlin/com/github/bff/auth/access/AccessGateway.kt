package com.github.bff.auth.access

// The Cloudflare Access group `ftree users`, which the Access policy lets in, and the Access sessions. AccessSync owns the
// group's email rules and always writes the complete list; emails are trimmed and lowercased.
interface AccessGateway {
    // False for the noop gateway, which neither reads nor writes anything.
    val configured: Boolean

    // The emails the group lets in.
    fun members(): Set<String>

    // Makes the group list exactly these emails, keeping its other rules; false when it did already, so nothing was written.
    fun replace(emails: Collection<String>): Boolean

    // Ends the person's Access sessions, so their next request needs a new one-time PIN.
    fun revokeSessions(email: String)
}

// Cloudflare could not be reached or refused the call. The message names the status and Cloudflare's error codes, never
// an email, so it may be logged.
class AccessGatewayException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

// Used without a Cloudflare API token, account, or group, as in development and tests: the sync is off, and ending
// sessions fails.
object NoopAccessGateway : AccessGateway {
    override val configured = false

    override fun members(): Set<String> = emptySet()

    override fun replace(emails: Collection<String>) = false

    override fun revokeSessions(email: String) = throw AccessGatewayException("No Cloudflare API token is configured")
}
