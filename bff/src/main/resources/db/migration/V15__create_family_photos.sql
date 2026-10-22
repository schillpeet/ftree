-- Uploaded family photos live apart from families so family listings never load the bytes.
CREATE TABLE family_photos (
    family_id uuid NOT NULL PRIMARY KEY REFERENCES families (id) ON DELETE CASCADE,
    content_type varchar(50) NOT NULL,
    data bytea NOT NULL,
    updated_at timestamptz NOT NULL
);
