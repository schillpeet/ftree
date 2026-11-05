-- The terms and the privacy notice as versions, and who accepted which. Every version is a migration of its own, so it
-- goes through a pull request and Flyway's checksum refuses later edits; there is no admin UI.
CREATE TABLE legal_documents (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind              text        NOT NULL CHECK (kind IN ('terms', 'privacy')),
    version           integer     NOT NULL CHECK (version > 0),
    -- From here on it applies; until then a version that needs action is only announced.
    effective_at      timestamptz NOT NULL,
    -- False only for corrections such as typos, which nobody has to accept again.
    requires_action   boolean     NOT NULL,
    -- Templates with {{operator.name}} and {{operator.email}}; only the German text is binding.
    body_de           text        NOT NULL,
    body_en           text        NOT NULL,
    -- What changed, one point per line; NULL for a first version.
    change_summary_de text,
    change_summary_en text,
    -- SHA-256 of body_de in hex.
    content_sha256    text        NOT NULL,
    UNIQUE (kind, version)
);

-- Only ever added to, and removed with the account. Neither an IP address nor a user agent belongs here.
CREATE TABLE legal_acceptances (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    document_id uuid        NOT NULL REFERENCES legal_documents (id),
    accepted_at timestamptz NOT NULL DEFAULT now(),
    -- The language of the text the person saw.
    language    text        NOT NULL CHECK (language IN ('de', 'en')),
    UNIQUE (user_id, document_id)
);
