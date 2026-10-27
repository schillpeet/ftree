package com.github.bff.auth.access

import com.github.bff.auth.normalizedEmail
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.http.HttpClient
import java.time.Duration

// The Cloudflare API (https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/): GET and PUT
// /accounts/{account}/access/groups/{group}, and POST /accounts/{account}/access/organizations/revoke_user. The token
// needs "Access: Organizations, Identity Providers, and Groups Edit" on the account.
class CloudflareAccessGateway(
    apiUrl: String,
    private val accountId: String,
    private val groupId: String,
    apiToken: String,
    timeout: Duration = Duration.ofSeconds(10),
) : AccessGateway {
    private val json = JsonMapper()
    private val client = RestClient.builder()
        .baseUrl(apiUrl.trim().trimEnd('/'))
        .requestFactory(
            JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(timeout).build()).apply { setReadTimeout(timeout) },
        )
        .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer ${apiToken.trim()}")
        .build()

    override val configured = true

    override fun members(): Set<String> = emailsOf(group())

    // PUT replaces the whole group, so its name and its rules other than emails are sent back as they are.
    override fun replace(emails: Collection<String>): Boolean {
        val group = group()
        val wanted = emails.map { it.normalizedEmail() }.toSortedSet()
        if (emailsOf(group) == wanted) return false
        val body = linkedMapOf<String, Any>(
            "name" to group.path("name").asString(),
            "include" to wanted.map { mapOf("email" to mapOf("email" to it)) } + group.path("include").filterNot(::isEmailRule),
        )
        listOf("exclude", "require").forEach { key -> group.get(key)?.takeIf { it.isArray && it.size() > 0 }?.let { body[key] = it } }
        call(HttpMethod.PUT, GROUP, body)
        return true
    }

    override fun revokeSessions(email: String) {
        call(HttpMethod.POST, REVOKE_USER, mapOf("email" to email.normalizedEmail()))
    }

    private fun group(): JsonNode = call(HttpMethod.GET, GROUP, null)

    private fun emailsOf(group: JsonNode): Set<String> =
        group.path("include").filter(::isEmailRule).map { it.path("email").path("email").asString().normalizedEmail() }.toSortedSet()

    private fun isEmailRule(rule: JsonNode) = rule.path("email").path("email").isString

    // Cloudflare wraps every answer in {success, errors, messages, result}; anything but success is an error.
    private fun call(method: HttpMethod, path: String, body: Any?): JsonNode {
        val request = client.method(method).uri(path, mapOf("account" to accountId, "group" to groupId))
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).body(json.writeValueAsString(body))
        val (status, bytes) = try {
            request.exchange { _, response -> response.statusCode.value() to response.body.readAllBytes() }
        } catch (exception: RestClientException) {
            throw AccessGatewayException("Cloudflare API not reachable for $method", exception)
        }
        val answer = runCatching { json.readTree(bytes) }.getOrNull()
        if (status !in 200..299 || answer?.path("success")?.asBoolean() != true) {
            val codes = answer?.path("errors")?.toList().orEmpty().map { it.path("code").asInt() }
            throw AccessGatewayException("Cloudflare API answered $method with $status, error codes $codes")
        }
        return answer.path("result")
    }

    private companion object {
        const val GROUP = "/accounts/{account}/access/groups/{group}"
        const val REVOKE_USER = "/accounts/{account}/access/organizations/revoke_user"
    }
}
