package com.github.bff.auth.access

import com.sun.net.httpserver.HttpServer
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.time.Duration
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// CloudflareAccessGateway against a fake Cloudflare API on localhost; no request leaves the machine.
class AccessGatewayTest {
    private val json = JsonMapper()
    private lateinit var server: HttpServer
    private lateinit var gateway: CloudflareAccessGateway

    private data class Call(val method: String, val path: String, val authorization: String?, val body: JsonNode?)

    private val calls = mutableListOf<Call>()

    // The group as Cloudflare keeps it; a PUT replaces it.
    private var group: Map<String, Any> = mapOf(
        "id" to GROUP,
        "name" to "ftree users",
        "include" to listOf(email("b@example.com"), email("A@Example.com "), mapOf("email_domain" to mapOf("domain" to "example.org"))),
        "exclude" to emptyList<Any>(),
        "require" to emptyList<Any>(),
    )

    // status and body for the next answer instead of the group's.
    private var failure: Pair<Int, String>? = null

    private fun email(address: String) = mapOf("email" to mapOf("email" to address))

    @BeforeTest
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/client/v4/") { exchange ->
            val bytes = exchange.requestBody.readAllBytes()
            val body = if (bytes.isEmpty()) null else json.readTree(bytes)
            calls += Call(exchange.requestMethod, exchange.requestURI.path, exchange.requestHeaders.getFirst("Authorization"), body)
            val (status, answer) = failure ?: when {
                exchange.requestURI.path.endsWith("/access/groups/$GROUP") -> {
                    if (exchange.requestMethod == "PUT") group = json.convertValue(body, Map::class.java).mapKeys { it.key.toString() }.mapValues { it.value!! }
                    200 to json.writeValueAsString(mapOf("success" to true, "errors" to emptyList<Any>(), "messages" to emptyList<Any>(), "result" to group))
                }
                exchange.requestURI.path.endsWith("/access/organizations/revoke_user") -> 200 to """{"result":true,"success":true}"""
                else -> 404 to """{"success":false,"errors":[{"code":7003,"message":"No route"}]}"""
            }
            val out = answer.toByteArray()
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(status, out.size.toLong())
            exchange.responseBody.use { it.write(out) }
        }
        server.start()
        gateway = CloudflareAccessGateway(
            "http://127.0.0.1:${server.address.port}/client/v4/", ACCOUNT, GROUP, "test-token", Duration.ofSeconds(2),
        )
    }

    @AfterTest
    fun stop() = server.stop(0)

    @Test
    fun `reads the emails of the group, normalized`() {
        assertEquals(setOf("a@example.com", "b@example.com"), gateway.members())
        assertEquals(Call("GET", "/client/v4/accounts/$ACCOUNT/access/groups/$GROUP", "Bearer test-token", null), calls.single())
    }

    @Test
    fun `writes the complete include list and keeps the name and the other rules`() {
        assertTrue(gateway.replace(listOf("c@example.com", "A@example.com")))

        val put = calls.single { it.method == "PUT" }
        assertEquals("/client/v4/accounts/$ACCOUNT/access/groups/$GROUP", put.path)
        assertEquals("Bearer test-token", put.authorization)
        assertEquals(
            json.readTree(
                """{"name":"ftree users","include":[{"email":{"email":"a@example.com"}},{"email":{"email":"c@example.com"}},""" +
                    """{"email_domain":{"domain":"example.org"}}]}""",
            ),
            put.body,
        )
        assertEquals(setOf("a@example.com", "c@example.com"), gateway.members())
    }

    @Test
    fun `writing the same list again changes nothing`() {
        assertTrue(gateway.replace(listOf("c@example.com")))
        assertFalse(gateway.replace(listOf("C@example.com ")))
        assertEquals(1, calls.count { it.method == "PUT" })
    }

    @Test
    fun `ends the sessions of one person`() {
        gateway.revokeSessions(" Someone@Example.com")

        val call = calls.single()
        assertEquals("POST", call.method)
        assertEquals("/client/v4/accounts/$ACCOUNT/access/organizations/revoke_user", call.path)
        assertEquals(json.readTree("""{"email":"someone@example.com"}"""), call.body)
    }

    @Test
    fun `an error answer names the status and codes but no email`() {
        failure = 403 to """{"success":false,"errors":[{"code":10000,"message":"Authentication error for a@example.com"}]}"""
        val exception = assertFailsWith<AccessGatewayException> { gateway.revokeSessions("a@example.com") }
        assertEquals("Cloudflare API answered POST with 403, error codes [10000]", exception.message)
    }

    @Test
    fun `a 200 without success, or without JSON, is an error too`() {
        failure = 200 to """{"success":false,"errors":[{"code":9109}]}"""
        assertFailsWith<AccessGatewayException> { gateway.members() }
        failure = 502 to "<html>Bad gateway</html>"
        val exception = assertFailsWith<AccessGatewayException> { gateway.replace(listOf("a@example.com")) }
        assertEquals("Cloudflare API answered GET with 502, error codes []", exception.message)
        assertTrue(calls.none { it.method == "PUT" })
    }

    @Test
    fun `an unreachable API is an error`() {
        val closed = ServerSocket(0, 1, InetAddress.getLoopbackAddress()).use { it.localPort }
        val unreachable = CloudflareAccessGateway("http://127.0.0.1:$closed/client/v4", ACCOUNT, GROUP, "test-token", Duration.ofSeconds(2))
        assertFailsWith<AccessGatewayException> { unreachable.members() }
    }

    @Test
    fun `the noop gateway syncs nothing and cannot end sessions`() {
        assertFalse(NoopAccessGateway.configured)
        assertEquals(emptySet(), NoopAccessGateway.members())
        assertFalse(NoopAccessGateway.replace(listOf("a@example.com")))
        assertFailsWith<AccessGatewayException> { NoopAccessGateway.revokeSessions("a@example.com") }
    }

    private companion object {
        const val ACCOUNT = "0123456789abcdef0123456789abcdef"
        const val GROUP = "00000000-0000-4000-8000-000000000001"
    }
}
