-- Uploaded photos live apart from members so member listings never load the bytes.
CREATE TABLE member_photos (
    member_id uuid NOT NULL PRIMARY KEY REFERENCES members (id) ON DELETE CASCADE,
    content_type varchar(50) NOT NULL,
    data bytea NOT NULL,
    updated_at timestamptz NOT NULL
);
