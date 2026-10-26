package com.github.bff.auth

import com.github.bff.generated.api.UsersApi
import com.github.bff.generated.model.UserLogin
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

// Everyone listed, in the order of the access file, then everyone else with a right in the database by email, then
// everyone else who signed in, most recent first.
@RestController
class UsersController(
    private val accessPolicy: AccessPolicy,
    private val memberships: Memberships,
    private val loginRecorder: LoginRecorder,
) : UsersApi {
    override fun getUsers(): ResponseEntity<List<UserLogin>> {
        val logins = loginRecorder.logins()
        val listed = (accessPolicy.listed() + memberships.people()).distinct()
        val unlisted = (logins.keys - listed.toSet()).sortedWith(compareByDescending(nullsFirst()) { logins.getValue(it).lastSeen })
        return ResponseEntity.ok(
            listed.map { UserLogin(it, true, logins[it]?.firstSeen, logins[it]?.lastSeen) } +
                unlisted.map { UserLogin(it, false, logins.getValue(it).firstSeen, logins.getValue(it).lastSeen) },
        )
    }
}
