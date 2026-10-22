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
class FamilyPhotoTest {
    @Autowired
    private lateinit var familyService: FamilyService

    @Autowired
    private lateinit var familyRepository: FamilyRepository

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    private fun createFamily() =
        (familyService.create(CreateFamilyRequest("Family photo test ${UUID.randomUUID()}", 1, 1, 0, 0)) as FamilyCreationResult.CREATED).summary.id

    private val bytes = byteArrayOf(1, 2, 3)

    @Test
    fun `stores, replaces, and removes a photo`() {
        val family = createFamily()
        val other = createFamily()
        assertNull(familyService.findAll().single { it.id == family }.photoUpdatedAt)
        assertEquals(PhotoResult.UPDATED, familyService.updatePhoto(family, "image/png", bytes))
        assertEquals(PhotoResult.UPDATED, familyService.updatePhoto(family, "image/jpeg; charset=x", bytes + 4))

        val photo = assertNotNull(familyService.findPhoto(family))
        assertEquals("image/jpeg", photo.contentType)
        assertContentEquals(bytes + 4, photo.data)
        val families = familyService.findAll()
        assertNotNull(families.single { it.id == family }.photoUpdatedAt)
        assertNull(families.single { it.id == other }.photoUpdatedAt)
        assertNull(familyService.findPhoto(other))

        assertEquals(true, familyService.deletePhoto(family))
        assertNull(familyService.findPhoto(family))
        assertEquals(false, familyService.deletePhoto(family))
    }

    @Test
    fun `rejects other types, empty and oversized photos, and unknown families`() {
        val family = createFamily()
        assertEquals(PhotoResult.UNSUPPORTED_TYPE, familyService.updatePhoto(family, "image/gif", bytes))
        assertEquals(PhotoResult.UNSUPPORTED_TYPE, familyService.updatePhoto(family, null, bytes))
        assertEquals(PhotoResult.INVALID, familyService.updatePhoto(family, "image/png", ByteArray(0)))
        assertEquals(PhotoResult.TOO_LARGE, familyService.updatePhoto(family, "image/png", ByteArray(MAX_PHOTO_BYTES + 1)))
        assertEquals(PhotoResult.UPDATED, familyService.updatePhoto(family, "image/png", ByteArray(MAX_PHOTO_BYTES)))
        assertEquals(PhotoResult.NOT_FOUND, familyService.updatePhoto(UUID.randomUUID(), "image/png", bytes))
    }

    @Test
    fun `deleting the family removes the photo`() {
        val family = createFamily()
        familyService.updatePhoto(family, "image/webp", bytes)
        assertEquals(true, familyService.delete(family))
        familyRepository.flush()
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM family_photos WHERE family_id = ?", Int::class.java, family))
    }
}
