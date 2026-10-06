package com.github.bff.member

import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Member
import com.github.bff.generated.model.Placement
import com.github.bff.generated.model.Position
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class MemberPlacementTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberService: MemberService

    private val family by lazy {
        (familyService.create(CreateFamilyRequest("Placement test ${UUID.randomUUID()}", 4, 2, 0, 2)) as FamilyCreationResult.CREATED).summary.id
    }

    private fun members() = memberService.findAll(family)!!
    private fun member(id: UUID) = members().single { it.id == id }
    private fun pin(id: Int) = Placement().pinId(id)
    private fun place(member: Member, placement: Placement) = memberService.updatePlacement(family, member.id, placement)

    @Test
    fun `generated members start unplaced`() {
        assertTrue(members().all { it.pinId == null && it.position == null })
    }

    @Test
    fun `pins a member and places it freely`() {
        val anna = members().first()
        assertEquals(PlacementResult.UPDATED, place(anna, pin(3)))
        assertEquals(3, member(anna.id).pinId)

        assertEquals(PlacementResult.UPDATED, place(anna, Placement().position(Position(1.0, 2.0, 3.0))))
        assertNull(member(anna.id).pinId)
        assertEquals(Position(1.0, 2.0, 3.0), member(anna.id).position)
    }

    @Test
    fun `a pin holds one card until it is moved or deleted`() {
        val (anna, ben, carl) = members()
        assertEquals(PlacementResult.UPDATED, place(anna, pin(0)))
        assertEquals(PlacementResult.UPDATED, place(anna, pin(0)))
        assertEquals(PlacementResult.PIN_TAKEN, place(ben, pin(0)))

        assertEquals(PlacementResult.UPDATED, place(anna, pin(1)))
        assertEquals(PlacementResult.UPDATED, place(ben, pin(0)))

        assertTrue(memberService.delete(family, ben.id))
        assertEquals(PlacementResult.UPDATED, place(carl, pin(0)))
    }

    @Test
    fun `rejects invalid placements and foreign members`() {
        val anna = members().first()
        assertEquals(PlacementResult.INVALID, place(anna, Placement()))
        assertEquals(PlacementResult.INVALID, place(anna, pin(0).position(Position(0.0, 0.0, 0.0))))
        assertEquals(PlacementResult.INVALID, place(anna, pin(-1)))

        val other = (familyService.create(CreateFamilyRequest("Placement other ${UUID.randomUUID()}", 4, 2, 0, 2)) as FamilyCreationResult.CREATED).summary.id
        assertEquals(PlacementResult.NOT_FOUND, memberService.updatePlacement(other, anna.id, pin(0)))
    }

    @Test
    fun `updating member data keeps the placement`() {
        val anna = members().first()
        place(anna, pin(2))
        memberService.update(family, anna.id, CreateMemberRequest("Renamed", anna.lastName))
        assertEquals(2, member(anna.id).pinId)
    }
}
