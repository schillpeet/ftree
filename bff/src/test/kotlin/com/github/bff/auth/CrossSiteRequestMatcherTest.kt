package com.github.bff.auth

import org.springframework.mock.web.MockHttpServletRequest
import kotlin.test.Test
import kotlin.test.assertEquals

class CrossSiteRequestMatcherTest {
    private val matcher = CrossSiteRequestMatcher(setOf("https://ftree.example"))

    private fun crossSite(method: String, site: String? = null, origin: String? = null) =
        matcher.matches(
            MockHttpServletRequest(method, "/families").apply {
                site?.let { addHeader("Sec-Fetch-Site", it) }
                origin?.let { addHeader("Origin", it) }
            },
        )

    @Test
    fun `writes from other sites need protection`() {
        listOf("POST", "PUT", "DELETE", "PATCH").forEach { method ->
            assertEquals(true, crossSite(method, site = "cross-site"), method)
            assertEquals(true, crossSite(method, site = "same-site", origin = "https://other.ftree.example"), method)
            assertEquals(true, crossSite(method, origin = "https://evil.example"), method)
            assertEquals(true, crossSite(method, site = "cross-site", origin = "null"), method)
        }
    }

    @Test
    fun `same-origin writes, allowed origins, and clients without browser headers pass`() {
        assertEquals(false, crossSite("POST", site = "same-origin", origin = "https://ftree.example"))
        assertEquals(false, crossSite("POST", site = "same-origin"))
        assertEquals(false, crossSite("POST", site = "none"))
        assertEquals(false, crossSite("POST", site = "cross-site", origin = "https://ftree.example"))
        assertEquals(false, crossSite("POST", origin = "https://ftree.example"))
        assertEquals(false, crossSite("DELETE"))
    }

    @Test
    fun `reads never need protection`() {
        listOf("GET", "HEAD", "OPTIONS", "TRACE").forEach { method ->
            assertEquals(false, crossSite(method, site = "cross-site", origin = "https://evil.example"), method)
        }
    }
}
