package com.github.bff.member

import com.github.bff.generated.model.CreateFamilyRequest
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

@SpringBootTest
@Transactional
class MemberPhotoTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var memberService: MemberService

    @Autowired
    private lateinit var memberRepository: MemberRepository

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private val family by lazy {
        (familyService.create(CreateFamilyRequest("Photo test ${UUID.randomUUID()}", 2, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id
    }

    private val anna by lazy { memberService.findAll(family)!!.first().id }
    private val bytes = byteArrayOf(1, 2, 3)

    @Test
    fun `stores, replaces, and removes a photo`() {
        assertNull(memberService.findAll(family)!!.single { it.id == anna }.photoUpdatedAt)
        assertEquals(PhotoResult.UPDATED, memberService.updatePhoto(family, anna, "image/png", bytes))
        assertEquals(PhotoResult.UPDATED, memberService.updatePhoto(family, anna, "image/jpeg; charset=x", bytes + 4))

        val photo = assertNotNull(memberService.findPhoto(family, anna))
        assertEquals("image/jpeg", photo.contentType)
        assertContentEquals(bytes + 4, photo.data)
        val members = memberService.findAll(family)!!
        assertNotNull(members.single { it.id == anna }.photoUpdatedAt)
        assertNull(members.single { it.id != anna }.photoUpdatedAt)

        assertEquals(true, memberService.deletePhoto(family, anna))
        assertNull(memberService.findPhoto(family, anna))
        assertEquals(false, memberService.deletePhoto(family, anna))
    }

    @Test
    fun `rejects other types, empty and oversized photos, and foreign members`() {
        assertEquals(PhotoResult.UNSUPPORTED_TYPE, memberService.updatePhoto(family, anna, "image/gif", bytes))
        assertEquals(PhotoResult.UNSUPPORTED_TYPE, memberService.updatePhoto(family, anna, null, bytes))
        assertEquals(PhotoResult.INVALID, memberService.updatePhoto(family, anna, "image/png", ByteArray(0)))
        assertEquals(PhotoResult.TOO_LARGE, memberService.updatePhoto(family, anna, "image/png", ByteArray(MAX_PHOTO_BYTES + 1)))
        assertEquals(PhotoResult.UPDATED, memberService.updatePhoto(family, anna, "image/png", ByteArray(MAX_PHOTO_BYTES)))

        val other = (familyService.create(CreateFamilyRequest("Photo other ${UUID.randomUUID()}", 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id
        assertEquals(PhotoResult.NOT_FOUND, memberService.updatePhoto(other, anna, "image/png", bytes))
        assertNull(memberService.findPhoto(other, anna))
        assertEquals(false, memberService.deletePhoto(other, anna))
    }

    @Test
    fun `deleting the member removes the photo`() {
        memberService.updatePhoto(family, anna, "image/webp", bytes)
        memberService.delete(family, anna)
        memberRepository.flush()
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM member_photos WHERE member_id = ?", Int::class.java, anna))
    }
}
