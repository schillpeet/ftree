package com.github.bff.legal

import com.github.bff.auth.AuditLog
import com.github.bff.auth.normalizedEmail
import com.github.bff.generated.model.LegalAcceptance
import com.github.bff.generated.model.LegalDocument
import com.github.bff.generated.model.LegalDocumentNotice
import com.github.bff.generated.model.LegalDocumentRef
import com.github.bff.generated.model.LegalKind
import com.github.bff.generated.model.LegalLanguage
import com.github.bff.generated.model.LegalVersion
import com.github.bff.generated.model.ProblemCode
import com.github.bff.problem.ApiProblem
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID

// What a person still has to accept. An interface so that the tests, which sign in as ever new people, can leave the
// gate out unless they test it (LegalGateOffInTests); there is no switch for this in production.
fun interface OpenLegalDocuments {
    fun anyOpenFor(email: String): Boolean
}

// One version of a document, seen from one person.
internal data class LegalRow(
    val id: UUID,
    val kind: String,
    val version: Int,
    val effectiveAt: OffsetDateTime,
    val requiresAction: Boolean,
    val summaryDe: String?,
    val summaryEn: String?,
    val accepted: Boolean,
)

internal fun LegalRow.notice(previous: Int?) =
    LegalDocumentNotice(LegalKind.fromValue(kind), version, effectiveAt, previous, summaryDe, summaryEn)

// The version in force of each kind that the person still has to accept. It is open when they accepted neither the latest
// version in force that needed action nor anything after it, so a correction asks nobody who accepted the version before it;
// whoever has to accept anyway accepts the newest text.
internal fun pendingOf(rows: List<LegalRow>, now: Instant): List<LegalRow> =
    rows.filter { !it.effectiveAt.toInstant().isAfter(now) }.groupBy { it.kind }.values.mapNotNull { versions ->
        val current = versions.maxBy { it.version }
        val binding = versions.filter { it.requiresAction }.maxOfOrNull { it.version } ?: return@mapNotNull null
        current.takeIf { versions.none { it.accepted && it.version >= binding } }
    }

// Versions that will need acceptance but do not apply yet.
internal fun announcedOf(rows: List<LegalRow>, now: Instant): List<LegalRow> =
    rows.filter { it.requiresAction && it.effectiveAt.toInstant().isAfter(now) }

@Service
class LegalService(private val jdbc: JdbcTemplate, private val auditLog: AuditLog) : OpenLegalDocuments {
    // Both tables are tiny and a person's rows are found through the unique index, so this is cheap on every request.
    private fun rowsFor(email: String): List<LegalRow> =
        jdbc.query(
            "SELECT d.id, d.kind, d.version, d.effective_at, d.requires_action, d.change_summary_de, d.change_summary_en, a.id IS NOT NULL " +
                "FROM legal_documents d " +
                "LEFT JOIN legal_acceptances a ON a.document_id = d.id AND a.user_id = (SELECT id FROM users WHERE email = ?) " +
                "ORDER BY d.kind, d.version",
            { rs, _ ->
                LegalRow(
                    rs.getObject(1, UUID::class.java),
                    rs.getString(2),
                    rs.getInt(3),
                    rs.getObject(4, OffsetDateTime::class.java),
                    rs.getBoolean(5),
                    rs.getString(6),
                    rs.getString(7),
                    rs.getBoolean(8),
                )
            },
            email.normalizedEmail(),
        )

    override fun anyOpenFor(email: String): Boolean = pendingOf(rowsFor(email), Instant.now()).isNotEmpty()

    data class Notices(val pending: List<LegalDocumentNotice>, val announced: List<LegalDocumentNotice>)

    fun notices(email: String): Notices {
        val rows = rowsFor(email)
        val now = Instant.now()
        fun previous(kind: String) = rows.filter { it.kind == kind && it.accepted }.maxOfOrNull { it.version }
        return Notices(
            pendingOf(rows, now).map { it.notice(previous(it.kind)) },
            announcedOf(rows, now).map { it.notice(previous(it.kind)) },
        )
    }

    // Only what is open can be accepted, and what was accepted before stays as it was, so a second click changes nothing.
    @Transactional
    fun accept(email: String, documents: List<LegalDocumentRef>, language: LegalLanguage) {
        val key = email.normalizedEmail()
        val rows = rowsFor(key)
        val pending = pendingOf(rows, Instant.now())
        val chosen = documents.distinct().mapNotNull { ref ->
            val row = rows.firstOrNull { it.kind == ref.kind.value && it.version == ref.version }
            if (row == null || (row !in pending && !row.accepted)) throw ApiProblem(ProblemCode.INVALID_REQUEST)
            row.takeIf { it in pending && !it.accepted }
        }
        // LoginRecorder has normally added the row already.
        jdbc.update("INSERT INTO users (email, first_seen, last_seen) VALUES (?, now(), now()) ON CONFLICT (email) DO NOTHING", key)
        chosen.forEach { row ->
            val added = jdbc.update(
                "INSERT INTO legal_acceptances (user_id, document_id, language) " +
                    "SELECT id, ?, ? FROM users WHERE email = ? ON CONFLICT (user_id, document_id) DO NOTHING",
                row.id, language.value, key,
            )
            if (added == 1) {
                auditLog.record(
                    key,
                    "legal.accepted",
                    "legal",
                    "${row.kind}:${row.version}",
                    mapOf("kind" to row.kind, "version" to row.version.toString(), "language" to language.value),
                )
            }
        }
    }

    fun acceptancesOf(email: String): List<LegalAcceptance> =
        acceptances("u.email = ?", email.normalizedEmail())

    // Null when there is no such person.
    fun acceptancesOf(userId: UUID): List<LegalAcceptance>? {
        val exists = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM users WHERE id = ?)", Boolean::class.java, userId)
        return if (exists == true) acceptances("u.id = ?", userId) else null
    }

    private fun acceptances(condition: String, argument: Any): List<LegalAcceptance> =
        jdbc.query(
            "SELECT d.kind, d.version, d.effective_at, a.accepted_at, a.language " +
                "FROM legal_acceptances a JOIN legal_documents d ON d.id = a.document_id JOIN users u ON u.id = a.user_id " +
                "WHERE $condition ORDER BY a.accepted_at DESC, d.kind",
            { rs, _ ->
                LegalAcceptance(
                    LegalKind.fromValue(rs.getString(1)),
                    rs.getInt(2),
                    rs.getObject(3, OffsetDateTime::class.java),
                    rs.getObject(4, OffsetDateTime::class.java),
                    LegalLanguage.fromValue(rs.getString(5)),
                )
            },
            argument,
        )

    // The version in force without `version`; with one, any published version, announced ones included.
    fun document(kind: LegalKind, version: Int?): LegalDocument? {
        val versions = jdbc.query(
            "SELECT version, effective_at FROM legal_documents WHERE kind = ? ORDER BY version DESC",
            { rs, _ -> LegalVersion(rs.getInt(1), rs.getObject(2, OffsetDateTime::class.java)) },
            kind.value,
        )
        val now = Instant.now()
        val chosen = version ?: versions.firstOrNull { !it.effectiveAt.toInstant().isAfter(now) }?.version ?: return null
        return jdbc.query(
            "SELECT version, effective_at, body_de, body_en, content_sha256 FROM legal_documents WHERE kind = ? AND version = ?",
            { rs, _ ->
                LegalDocument(
                    kind,
                    rs.getInt(1),
                    rs.getObject(2, OffsetDateTime::class.java),
                    rs.getString(3),
                    rs.getString(4),
                    rs.getString(5),
                    versions,
                )
            },
            kind.value,
            chosen,
        ).singleOrNull()
    }
}
