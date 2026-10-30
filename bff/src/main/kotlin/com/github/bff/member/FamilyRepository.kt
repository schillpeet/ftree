package com.github.bff.member

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface FamilyRepository : JpaRepository<FamilyEntity, UUID> {
    fun findAllByOrderByPositionAsc(): List<FamilyEntity>

    fun findByNameIgnoreCase(name: String): FamilyEntity?

    fun existsByNameIgnoreCase(name: String): Boolean

    fun existsBySlug(slug: String): Boolean

    // Trash.
    fun findAllByDeletedAtIsNullOrderByPositionAsc(): List<FamilyEntity>

    fun findAllByDeletedAtIsNotNullOrderByDeletedAtAsc(): List<FamilyEntity>

    fun existsByNameIgnoreCaseAndDeletedAtIsNotNull(name: String): Boolean

    // Families outside the trash in which the person is an owner; family_memberships has no entity.
    @Query(
        "SELECT count(*) FROM families f JOIN family_memberships m ON m.family_id = f.id " +
            "WHERE m.email = :email AND m.role = 'owner' AND f.deleted_at IS NULL",
        nativeQuery = true,
    )
    fun countOwnedBy(email: String): Long
}
