package com.github.bff.member

import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.Partnership
import com.github.bff.generated.model.Partnership.StatusEnum.DIVORCED
import com.github.bff.generated.model.Partnership.StatusEnum.MARRIED
import com.github.bff.generated.model.Partnership.StatusEnum.SEPARATED
import com.github.bff.generated.model.Partnership.StatusEnum.TOGETHER
import com.github.bff.generated.model.Partnership.StatusEnum.WIDOWED
import com.github.bff.generated.model.Relatives
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class PartnershipTest {
    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberService: MemberService

    private lateinit var familyId: UUID
    private lateinit var anna: UUID
    private lateinit var bernd: UUID
    private lateinit var child: UUID

    private val wedding = LocalDate.of(1985, 6, 12)
    private val start = LocalDate.of(1983, 2, 1)
    private val end = LocalDate.of(1999, 9, 30)

    @BeforeTest
    fun createFamily() {
        familyId = familyRepository.save(FamilyEntity(name = "Partnership test ${UUID.randomUUID()}")).id
        anna = memberService.create(familyId, CreateMemberRequest("Anna", "Alt"))!!.id
        bernd = memberService.create(familyId, CreateMemberRequest("Bernd", "Alt"))!!.id
        child = memberService.create(familyId, CreateMemberRequest("Clara", "Alt"))!!.id
    }

    @Test
    fun `stores the wedding date for both partners`() {
        update(anna, listOf(Partnership(bernd, MARRIED).marriedOn(wedding)))

        assertEquals(listOf(MARRIED to wedding), detailsOf(anna))
        assertEquals(listOf(MARRIED to wedding), detailsOf(bernd))
    }

    @Test
    fun `keeps details when partnerships are absent and resets them when left out`() {
        update(anna, listOf(Partnership(bernd, MARRIED).marriedOn(wedding)))
        // Assigning a child to Bernd without partnerships keeps the marriage.
        memberService.updateRelatives(familyId, bernd, Relatives(emptyList(), listOf(child), listOf(anna)))
        assertEquals(listOf(MARRIED to wedding), detailsOf(bernd))

        update(anna, emptyList())
        assertEquals(listOf(TOGETHER to null), detailsOf(bernd))
    }

    @Test
    fun `drops the wedding date of couples who are only together`() {
        update(anna, listOf(Partnership(bernd, TOGETHER).marriedOn(wedding)))

        assertEquals(listOf(TOGETHER to null), detailsOf(anna))
    }

    @Test
    fun `stores separated couples for both partners and drops their wedding date`() {
        update(anna, listOf(Partnership(bernd, SEPARATED).marriedOn(wedding)))

        assertEquals(listOf(SEPARATED to null), detailsOf(anna))
        assertEquals(listOf(SEPARATED to null), detailsOf(bernd))
    }

    @Test
    fun `stores divorced couples with wedding and divorce date for both partners`() {
        update(anna, listOf(Partnership(bernd, DIVORCED).since(start).marriedOn(wedding).endedOn(end)))

        val divorced = listOf(Partnership(bernd, DIVORCED).marriedOn(wedding).endedOn(end))
        assertEquals(divorced, partnershipsOf(anna))
        assertEquals(listOf(Partnership(anna, DIVORCED).marriedOn(wedding).endedOn(end)), partnershipsOf(bernd))
    }

    @Test
    fun `stores widowed partners with wedding date and date of death`() {
        update(anna, listOf(Partnership(bernd, WIDOWED).since(start).marriedOn(wedding).endedOn(end)))

        assertEquals(listOf(Partnership(bernd, WIDOWED).marriedOn(wedding).endedOn(end)), partnershipsOf(anna))
        assertEquals(listOf(Partnership(anna, WIDOWED).marriedOn(wedding).endedOn(end)), partnershipsOf(bernd))
    }

    @Test
    fun `keeps only the dates that belong to the status`() {
        update(anna, listOf(Partnership(bernd, TOGETHER).since(start).marriedOn(wedding).endedOn(end)))
        assertEquals(listOf(Partnership(bernd, TOGETHER).since(start)), partnershipsOf(anna))

        update(anna, listOf(Partnership(bernd, SEPARATED).since(start).marriedOn(wedding).endedOn(end)))
        assertEquals(listOf(Partnership(bernd, SEPARATED).endedOn(end)), partnershipsOf(anna))
    }

    @Test
    fun `rejects dates in the future and divorces before the wedding`() {
        val future = LocalDate.now().plusYears(1)
        listOf(
            Partnership(bernd, MARRIED).marriedOn(future),
            Partnership(bernd, TOGETHER).since(future),
            Partnership(bernd, DIVORCED).marriedOn(wedding).endedOn(future),
            Partnership(bernd, DIVORCED).marriedOn(end).endedOn(wedding),
        ).forEach { partnership ->
            val result = memberService.updateRelatives(
                familyId, anna,
                Relatives(emptyList(), emptyList(), listOf(bernd)).partnerships(listOf(partnership)),
            )
            assertEquals(RelativesResult.INVALID, result, partnership.toString())
        }
        // A future date the status does not keep is dropped, not rejected.
        update(anna, listOf(Partnership(bernd, TOGETHER).marriedOn(future)))
    }

    @Test
    fun `rejects details for someone who is not a partner`() {
        val result = memberService.updateRelatives(
            familyId, anna,
            Relatives(emptyList(), emptyList(), listOf(bernd)).partnerships(listOf(Partnership(child, MARRIED))),
        )

        assertEquals(RelativesResult.INVALID, result)
    }

    private fun update(id: UUID, partnerships: List<Partnership>) =
        assertEquals(
            RelativesResult.UPDATED,
            memberService.updateRelatives(familyId, id, Relatives(emptyList(), emptyList(), listOf(bernd)).partnerships(partnerships)),
        )

    private fun partnershipsOf(id: UUID) = memberService.findAll(familyId)!!.single { it.id == id }.partnerships

    private fun detailsOf(id: UUID) =
        memberService.findAll(familyId)!!.single { it.id == id }.partnerships.map { it.status to it.marriedOn }
}
