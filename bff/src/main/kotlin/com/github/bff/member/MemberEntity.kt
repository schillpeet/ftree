package com.github.bff.member

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.util.UUID

@Entity
@Table(name = "members")
class MemberEntity(
    @Id
    @Column(nullable = false, updatable = false)
    var id: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 100)
    var firstName: String,
    @Column(nullable = false, length = 100)
    var lastName: String,
    var birthDate: LocalDate? = null,
    @Column(length = 200)
    var birthPlace: String? = null,
    var deathDate: LocalDate? = null,
    @Column(length = 200)
    var deathPlace: String? = null,
    @Column(length = 5000)
    var note: String? = null,
    @Column(length = 2048)
    var photoUrl: String? = null,
)
