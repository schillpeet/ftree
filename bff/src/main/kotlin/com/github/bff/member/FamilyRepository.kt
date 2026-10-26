package com.github.bff.member

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface FamilyRepository : JpaRepository<FamilyEntity, UUID> {
    fun findAllByOrderByPositionAsc(): List<FamilyEntity>

    // The first family without test settings in the saved order, not counting trashed ones.
    fun findFirstByTotalUsersIsNullAndDeletedAtIsNullOrderByPositionAsc(): FamilyEntity?

    fun findByNameIgnoreCase(name: String): FamilyEntity?

    fun existsByNameIgnoreCase(name: String): Boolean

    fun existsBySlug(slug: String): Boolean

    // Trash.
    fun findAllByDeletedAtIsNullOrderByPositionAsc(): List<FamilyEntity>

    fun findAllByDeletedAtIsNotNullOrderByDeletedAtAsc(): List<FamilyEntity>

    fun existsByNameIgnoreCaseAndDeletedAtIsNotNull(name: String): Boolean
}
