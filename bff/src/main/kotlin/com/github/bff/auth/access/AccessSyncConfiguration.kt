package com.github.bff.auth.access

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

// CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCESS_GROUP_ID; without all three the BFF uses NoopAccessGateway.
@ConfigurationProperties("app.cloudflare")
data class CloudflareProperties(
    val apiToken: String = "",
    val accountId: String = "",
    val accessGroupId: String = "",
    val apiUrl: String = "https://api.cloudflare.com/client/v4",
)

// dryRun only logs what a sync would change; a sync that removes more than maxRemovals addresses, or more than half of
// the group, is refused unless force is set. seatLimit is the number of people Cloudflare Access lets in on the plan.
@ConfigurationProperties("app.access-sync")
data class AccessSyncProperties(
    val dryRun: Boolean = false,
    val force: Boolean = false,
    val maxRemovals: Int = 5,
    val seatLimit: Int = 50,
)

@Configuration
@EnableConfigurationProperties(CloudflareProperties::class, AccessSyncProperties::class)
class AccessSyncConfiguration {
    // Logged once at startup, naming only the settings, never their values.
    @Bean
    fun accessGateway(properties: CloudflareProperties): AccessGateway {
        val missing = listOf(
            "CLOUDFLARE_API_TOKEN" to properties.apiToken,
            "CLOUDFLARE_ACCOUNT_ID" to properties.accountId,
            "CLOUDFLARE_ACCESS_GROUP_ID" to properties.accessGroupId,
        ).filter { it.second.isBlank() }.map { it.first }
        if (missing.isEmpty()) {
            log.info("Cloudflare Access sync is on")
            return CloudflareAccessGateway(properties.apiUrl, properties.accountId.trim(), properties.accessGroupId.trim(), properties.apiToken)
        }
        if (missing.size < 3) log.warn("Cloudflare Access sync is off: {} not set, the others are", missing.joinToString())
        else log.info("Cloudflare Access sync is off: no Cloudflare API token, so the BFF uses the noop gateway")
        return NoopAccessGateway
    }

    private companion object {
        val log = LoggerFactory.getLogger(AccessSyncConfiguration::class.java)
    }
}
