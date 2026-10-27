package com.github.bff

import com.github.bff.auth.CloudflareTestDecoder
import org.junit.jupiter.api.extension.ExtendWith
import org.slf4j.LoggerFactory
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import org.springframework.boot.test.web.server.LocalManagementPort
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.context.annotation.Import
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private val client: HttpClient = HttpClient.newHttpClient()

private fun get(port: Int, path: String): HttpResponse<String> =
    client.send(HttpRequest.newBuilder(URI("http://localhost:$port$path")).GET().build(), HttpResponse.BodyHandlers.ofString())

@SpringBootTest(webEnvironment = RANDOM_PORT, properties = ["management.server.port=0", "app.auth.mode=dev", "app.roles.admins=dev@localhost"])
class ManagementPortTest {
    @LocalServerPort
    private var appPort = 0

    @LocalManagementPort
    private var managementPort = 0

    @Test
    fun `probes answer without a user and without details`() {
        listOf("/actuator/health/liveness", "/actuator/health/readiness").forEach { path ->
            val response = get(managementPort, path)
            assertEquals(200, response.statusCode(), path)
            assertEquals("""{"status":"UP"}""", response.body(), path)
        }
        val health = get(managementPort, "/actuator/health")
        assertEquals(200, health.statusCode())
        assertFalse(health.body().contains("components"), health.body())
    }

    @Test
    fun `prometheus scrape works on the management port`() {
        val response = get(managementPort, "/actuator/prometheus")
        assertEquals(200, response.statusCode())
        assertTrue(response.body().contains("jvm_memory_used_bytes"))
    }

    @Test
    fun `prometheus scrape has request buckets, active users per window, and access sync counters`() {
        get(appPort, "/me")
        val scrape = get(managementPort, "/actuator/prometheus").body()
        assertTrue(scrape.contains("http_server_requests_seconds_bucket"), scrape)
        listOf("1d", "7d", "30d").forEach { assertTrue(scrape.contains("ftree_users_active{window=\"$it\"}"), scrape) }
        assertTrue(scrape.contains("ftree_access_sync_runs_total{result=\"synced\"}"), scrape)
        assertTrue(scrape.contains("ftree_access_sync_changes_total{change=\"added\"}"), scrape)
    }

    @Test
    fun `other actuator endpoints are not exposed`() {
        listOf("/actuator/env", "/actuator/beans", "/actuator/metrics").forEach { path ->
            assertTrue(get(managementPort, path).statusCode() in listOf(403, 404), path)
        }
    }

    // The UI's /api rewrite forwards to the app port, so it must not reach the actuator there.
    @Test
    fun `the app port does not serve the actuator`() {
        listOf("/actuator/health", "/actuator/health/liveness", "/actuator/prometheus").forEach { path ->
            assertFalse(get(appPort, path).statusCode() in 200..299, path)
        }
    }

    @Test
    fun `request metrics carry uri templates, never ids or emails`() {
        val familyId = UUID.randomUUID()
        get(appPort, "/families/$familyId/members")
        get(appPort, "/nope/someone@example.com")
        val scrape = get(managementPort, "/actuator/prometheus").body()
        assertTrue(scrape.contains("""uri="/families/{familyId}/members""""), scrape)
        assertFalse(scrape.contains(familyId.toString()))
        assertFalse(scrape.contains("someone@example.com"))
    }

    @Test
    @ExtendWith(OutputCaptureExtension::class)
    fun `logs are json`(output: CapturedOutput) {
        LoggerFactory.getLogger(ManagementPortTest::class.java).info("structured logging check")
        val line = output.out.lines().last { it.contains("structured logging check") }
        assertTrue(line.startsWith("{") && line.endsWith("}"), line)
        assertTrue(line.contains(""""log":{"level":"INFO""""), line)
    }
}

// Components are hidden in production; shown here only to see which checks each probe runs.
@SpringBootTest(
    webEnvironment = RANDOM_PORT,
    properties = [
        "management.server.port=0",
        "app.auth.mode=dev",
        "management.endpoint.health.group.readiness.show-components=always",
        "management.endpoint.health.group.liveness.show-components=always",
    ],
)
class ManagementPortProbeGroupsTest {
    @LocalManagementPort
    private var managementPort = 0

    @Test
    fun `readiness checks the database and liveness does not`() {
        val readiness = get(managementPort, "/actuator/health/readiness").body()
        assertTrue(readiness.contains(""""db":"""), readiness)
        assertTrue(readiness.contains(""""readinessState":"""), readiness)
        val liveness = get(managementPort, "/actuator/health/liveness").body()
        assertTrue(liveness.contains(""""livenessState":"""), liveness)
        assertFalse(liveness.contains(""""db":"""), liveness)
    }
}

@SpringBootTest(webEnvironment = RANDOM_PORT, properties = ["management.server.port=0"])
@Import(CloudflareTestDecoder::class)
class ManagementPortCloudflareModeTest {
    @LocalServerPort
    private var appPort = 0

    @LocalManagementPort
    private var managementPort = 0

    @Test
    fun `probes need no access token while the app port still requires one`() {
        assertEquals(200, get(managementPort, "/actuator/health/readiness").statusCode())
        assertEquals(200, get(managementPort, "/actuator/prometheus").statusCode())
        assertEquals(401, get(appPort, "/actuator/health").statusCode())
    }
}
