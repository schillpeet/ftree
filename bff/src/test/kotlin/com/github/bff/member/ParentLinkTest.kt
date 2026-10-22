package com.github.bff.member

import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.ParentLink
import com.github.bff.generated.model.ParentLink.KindEnum.BIOLOGICAL
import com.github.bff.generated.model.ParentLink.KindEnum.STEP
import com.github.bff.generated.model.Relatives
import com.github.bff.generated.model.Sibling
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class ParentLinkTest {
    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var memberService: MemberService

    private lateinit var familyId: UUID
    private lateinit var mother: UUID
    private lateinit var father: UUID
    private lateinit var stepfather: UUID
    private lateinit var child: UUID
    private lateinit var sibling: UUID

    @BeforeTest
    fun createFamily() {
        familyId = familyRepository.save(FamilyEntity(name = "Parent link test ${UUID.randomUUID()}")).id
        mother = memberService.create(familyId, CreateMemberRequest("Maria", "Moll"))!!.id
        father = memberService.create(familyId, CreateMemberRequest("Vinzenz", "Moll"))!!.id
        stepfather = memberService.create(familyId, CreateMemberRequest("Stefan", "Moll"))!!.id
        child = memberService.create(familyId, CreateMemberRequest("Clara", "Moll"))!!.id
        sibling = memberService.create(familyId, CreateMemberRequest("Sina", "Moll"))!!.id
    }

    @Test
    fun `stores the kind of each parent`() {
        store(child, listOf(mother, stepfather), listOf(mother to BIOLOGICAL, stepfather to STEP))

        assertEquals(setOf(mother to BIOLOGICAL, stepfather to STEP), linksOf(child))
    }

    @Test
    fun `parents left out of parentLinks are biological`() {
        store(child, listOf(mother, stepfather), listOf(stepfather to STEP))

        assertEquals(setOf(mother to BIOLOGICAL, stepfather to STEP), linksOf(child))
    }

    @Test
    fun `keeps kinds when parentLinks is absent`() {
        store(child, listOf(stepfather), listOf(stepfather to STEP))
        store(child, listOf(stepfather), null)

        assertEquals(setOf(stepfather to STEP), linksOf(child))
    }

    @Test
    fun `keeps the kind of a kept parent when another parent is added`() {
        store(child, listOf(stepfather), listOf(stepfather to STEP))
        store(child, listOf(stepfather, father), null)

        assertEquals(setOf(stepfather to STEP, father to BIOLOGICAL), linksOf(child))
    }

    @Test
    fun `keeps kinds when the child is added from the parent's side`() {
        store(child, listOf(stepfather), listOf(stepfather to STEP))

        val result = memberService.updateRelatives(familyId, mother, Relatives(emptyList(), listOf(child), emptyList()))

        assertEquals(RelativesResult.UPDATED, result)
        assertEquals(setOf(stepfather to STEP, mother to BIOLOGICAL), linksOf(child))
    }

    @Test
    fun `keeps kinds when siblings are saved`() {
        store(child, listOf(mother, stepfather), listOf(stepfather to STEP))

        val result = memberService.updateRelatives(
            familyId,
            sibling,
            Relatives(listOf(mother, stepfather), emptyList(), emptyList())
                .siblings(listOf(Sibling(child, listOf(mother, stepfather)))),
        )

        assertEquals(RelativesResult.UPDATED, result)
        assertEquals(setOf(mother to BIOLOGICAL, stepfather to STEP), linksOf(child))
    }

    @Test
    fun `rejects a kind for someone who is not a parent`() {
        val result = memberService.updateRelatives(
            familyId,
            child,
            Relatives(listOf(mother), emptyList(), emptyList()).parentLinks(listOf(ParentLink(father, STEP))),
        )

        assertEquals(RelativesResult.INVALID, result)
    }

    @Test
    fun `rejects a parent listed twice`() {
        val result = memberService.updateRelatives(
            familyId,
            child,
            Relatives(listOf(mother), emptyList(), emptyList())
                .parentLinks(listOf(ParentLink(mother, STEP), ParentLink(mother, BIOLOGICAL))),
        )

        assertEquals(RelativesResult.INVALID, result)
    }

    private fun store(id: UUID, parents: List<UUID>, links: List<Pair<UUID, ParentLink.KindEnum>>?) =
        assertEquals(
            RelativesResult.UPDATED,
            memberService.updateRelatives(
                familyId,
                id,
                Relatives(parents, emptyList(), emptyList()).parentLinks(links?.map { (parentId, kind) -> ParentLink(parentId, kind) }),
            ),
        )

    private fun linksOf(id: UUID) =
        memberService.findAll(familyId)!!.single { it.id == id }.parentLinks.map { it.parentId to it.kind }.toSet()
}
