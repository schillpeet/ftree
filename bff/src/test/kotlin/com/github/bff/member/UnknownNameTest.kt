package com.github.bff.member

import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class UnknownNameTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberService: MemberService

    @Test
    fun `stores unknown names as empty and trims the others`() {
        val family = (familyService.create(CreateFamilyRequest("Unknown name test ${UUID.randomUUID()}", 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id
        val father = memberService.create(family, CreateMemberRequest("", "  "))!!
        assertEquals("" to "", father.firstName to father.lastName)

        val renamed = memberService.update(family, father.id, CreateMemberRequest(" Hans ", ""))!!
        assertEquals("Hans" to "", renamed.firstName to renamed.lastName)
    }
}
