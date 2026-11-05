package com.github.bff.legal

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Component

// Tests sign in as ever new people, who have accepted nothing, so the gate stays out of their way; the tests of the gate
// itself set `test.legal.gate=on`. It lives here, not in the application, so that production has no way to turn it off.
@Component
@Primary
@ConditionalOnProperty(name = ["test.legal.gate"], havingValue = "off", matchIfMissing = true)
class LegalGateOffInTests : OpenLegalDocuments {
    override fun anyOpenFor(email: String) = false
}
