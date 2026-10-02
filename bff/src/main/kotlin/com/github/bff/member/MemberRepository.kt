package com.github.bff.member

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface MemberRepository : JpaRepository<MemberEntity, UUID> {
    fun findAllByParentsId(parentId: UUID): List<MemberEntity>

    fun findAllByPartnersId(partnerId: UUID): List<MemberEntity>
}
