package com.github.bff.member

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Generated
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "families")
class FamilyEntity(
    @Id
    @Column(nullable = false, updatable = false)
    var id: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 100)
    var name: String,
    // The family's URL segment, also used by the access file; random and fixed for good. FamilyService picks a free one.
    @Column(nullable = false, updatable = false, length = MAX_SLUG_LENGTH)
    var slug: String = randomSlug(),
    @Column(nullable = false, updatable = false)
    var createdAt: Instant = Instant.now(),
    // The trimmed, lowercased email of who created the family; null for families from before V18.
    @Column(updatable = false, length = 320)
    var createdBy: String? = null,
    var totalUsers: Int? = null,
    var generationCount: Int? = null,
    var minChildren: Int? = null,
    var maxChildren: Int? = null,
    // "cover" or "original"; every new family starts with "cover".
    @Column(nullable = false, length = 10)
    var photoFit: String = "cover",
    // The database assigns new families the next position, so they are listed last.
    @Generated
    @Column(nullable = false, insertable = false)
    var position: Int = 0,
    // Trash: a trashed family keeps its name, slug, members, and memberships but is invisible to everyone until it is
    // restored or TrashService purges it.
    var deletedAt: Instant? = null,
    @Column(length = 320)
    var deletedBy: String? = null,
)
