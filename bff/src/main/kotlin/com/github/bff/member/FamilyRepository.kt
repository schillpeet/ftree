package com.github.bff.member

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface FamilyRepository : JpaRepository<FamilyEntity, UUID> {
    fun findAllByOrderByCreatedAtAsc(): List<FamilyEntity>

    fun findByNameIgnoreCase(name: String): FamilyEntity?

    fun existsByNameIgnoreCase(name: String): Boolean
}
