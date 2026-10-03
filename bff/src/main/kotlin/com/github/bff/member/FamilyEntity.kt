package com.github.bff.member

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "families")
class FamilyEntity(
    @Id
    @Column(nullable = false, updatable = false)
    var id: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 100)
    var name: String,
    @Column(nullable = false, updatable = false)
    var createdAt: Instant = Instant.now(),
    var totalUsers: Int? = null,
    var generationCount: Int? = null,
    var minChildren: Int? = null,
    var maxChildren: Int? = null,
)
