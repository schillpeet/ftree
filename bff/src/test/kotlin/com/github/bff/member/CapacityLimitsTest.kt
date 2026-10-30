package com.github.bff.member

import com.github.bff.auth.Access
import com.github.bff.auth.CurrentUser
import com.github.bff.auth.CurrentUserAuthentication
import com.github.bff.generated.model.ArchiveFamilyRequest
import com.github.bff.generated.model.CreateEmptyFamilyRequest
import com.github.bff.generated.model.CreateFamilyRequest
import com.github.bff.generated.model.CreateMemberRequest
import com.github.bff.generated.model.ImportFamilyRequest
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class CapacityLimitsTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberService: MemberService

    @Autowired
    private lateinit var trash: TrashService

    @AfterTest
    fun tearDown() = SecurityContextHolder.clearContext()

    @Test
    fun `a plain user owns at most five trees outside the trash, test families included`() {
        signIn(admin = false)
        val first = (familyService.create(CreateFamilyRequest(name(), 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary
        repeat(MAX_OWNED_TREES - 1) { assertTrue(familyService.createEmpty(CreateEmptyFamilyRequest(name())) is FamilyCreationResult.CREATED) }

        assertProblem(ProblemCode.TREE_LIMIT_REACHED) { familyService.createEmpty(CreateEmptyFamilyRequest(name())) }
        assertProblem(ProblemCode.TREE_LIMIT_REACHED) { familyService.create(CreateFamilyRequest(name(), 1, 1, 0, 0)) }
        assertProblem(ProblemCode.TREE_LIMIT_REACHED) { familyService.import(ImportFamilyRequest(name(), gedcom(1))) }
        assertProblem(ProblemCode.TREE_LIMIT_REACHED) { familyService.archive(first.id, ArchiveFamilyRequest(name())) }

        // A trashed tree frees its slot.
        assertTrue(trash.trash(first.id))
        assertTrue(familyService.createEmpty(CreateEmptyFamilyRequest(name())) is FamilyCreationResult.CREATED)
    }

    @Test
    fun `admins may own more than five trees`() {
        signIn(admin = true)
        repeat(MAX_OWNED_TREES + 1) { assertTrue(familyService.createEmpty(CreateEmptyFamilyRequest(name())) is FamilyCreationResult.CREATED) }
    }

    @Test
    fun `a tree holds at most 100 people, whether added one by one or imported`() {
        signIn(admin = true)
        val full = (familyService.create(CreateFamilyRequest(name(), MAX_MEMBERS_PER_FAMILY, 1, 0, 0)) as FamilyCreationResult.CREATED).summary
        assertEquals(MAX_MEMBERS_PER_FAMILY, full.memberCount)

        assertProblem(ProblemCode.MEMBER_LIMIT_REACHED) { memberService.create(full.id, CreateMemberRequest("One", "Too many")) }
        assertProblem(ProblemCode.MEMBER_LIMIT_REACHED) { familyService.import(ImportFamilyRequest(name(), gedcom(MAX_MEMBERS_PER_FAMILY + 1))) }
        assertTrue(familyService.import(ImportFamilyRequest(name(), gedcom(MAX_MEMBERS_PER_FAMILY))) is FamilyImportResult.IMPORTED)
    }

    private fun signIn(admin: Boolean) {
        val access = Access(admin = admin)
        SecurityContextHolder.getContext().authentication =
            CurrentUserAuthentication(CurrentUser("limits-${UUID.randomUUID()}@example.com", access, verified = true))
    }

    private fun assertProblem(code: ProblemCode, block: () -> Unit) = assertEquals(code, assertFailsWith<ApiProblem> { block() }.code)

    private fun name() = "Capacity test ${UUID.randomUUID()}"

    private fun gedcom(people: Int) =
        (listOf("0 HEAD") + (1..people).flatMap { listOf("0 @I$it@ INDI", "1 NAME Person$it /Import/") } + "0 TRLR").joinToString("\n")
}
