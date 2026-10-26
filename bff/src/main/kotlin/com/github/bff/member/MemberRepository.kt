package com.github.bff.member

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface MemberRepository : JpaRepository<MemberEntity, UUID> {
    fun findAllByFamilyIdOrderByLastNameAscFirstNameAsc(familyId: UUID): List<MemberEntity>

    fun findByIdAndFamilyId(id: UUID, familyId: UUID): MemberEntity?

    fun existsByIdAndFamilyId(id: UUID, familyId: UUID): Boolean

    fun findAllByFamilyIdAndParentsId(familyId: UUID, parentId: UUID): List<MemberEntity>

    fun findAllByFamilyIdAndPartnersId(familyId: UUID, partnerId: UUID): List<MemberEntity>

    fun existsByFamilyIdAndPinIdAndIdNot(familyId: UUID, pinId: Int, id: UUID): Boolean

    fun countByFamilyId(familyId: UUID): Long
}
