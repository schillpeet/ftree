package com.github.bff.member

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface FamilyRepository : JpaRepository<FamilyEntity, UUID> {
    fun findAllByOrderByPositionAsc(): List<FamilyEntity>

    // The first family without test settings in the saved order.
    fun findFirstByTotalUsersIsNullOrderByPositionAsc(): FamilyEntity?

    fun findByNameIgnoreCase(name: String): FamilyEntity?

    fun existsByNameIgnoreCase(name: String): Boolean
}
