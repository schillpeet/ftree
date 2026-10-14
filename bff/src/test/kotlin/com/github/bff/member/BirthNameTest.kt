package com.github.bff.member

import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

@SpringBootTest
@Transactional
class BirthNameTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberService: MemberService

    @Test
    fun `stores, updates, and clears the birth name`() {
        val family = (familyService.create(CreateFamilyRequest("Birth name test ${UUID.randomUUID()}", 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id
        val anna = memberService.create(family, CreateMemberRequest("Anna", "Müller").birthName("Schmidt"))!!
        assertEquals("Schmidt", memberService.findAll(family)!!.single { it.id == anna.id }.birthName)

        memberService.update(family, anna.id, CreateMemberRequest("Anna", "Müller"))
        assertNull(memberService.findAll(family)!!.single { it.id == anna.id }.birthName)
    }
}
