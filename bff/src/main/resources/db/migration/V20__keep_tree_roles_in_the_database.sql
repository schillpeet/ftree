-- A users row now also stands for someone who has access but never signed in (first_seen and last_seen NULL);
-- admin and can_create_trees are global rights next to the roles per tree. id names a person in URLs and logs instead
-- of the email.
ALTER TABLE users
    ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN display_name varchar(100),
    ADD COLUMN admin boolean NOT NULL DEFAULT false,
    ADD COLUMN can_create_trees boolean NOT NULL DEFAULT false,
    ADD COLUMN invited_at timestamptz,
    ADD COLUMN invited_by varchar(320),
    ALTER COLUMN first_seen DROP NOT NULL,
    ALTER COLUMN last_seen DROP NOT NULL,
    ADD CONSTRAINT users_id_key UNIQUE (id);

-- Roles per tree, kept in the database instead of the access file; MembershipSeed fills the table once from the access
-- file and families.created_by. Emails are trimmed and lowercased, like users.email, and every member has a users row.
CREATE TABLE family_memberships (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id uuid NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    email varchar(320) NOT NULL REFERENCES users (email) ON DELETE CASCADE,
    role varchar(20) NOT NULL CHECK (role IN ('editor', 'visitor', 'developer')),
    -- NULL: granted by the BFF itself, for example by the seed.
    granted_by varchar(320),
    granted_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT family_memberships_family_email_key UNIQUE (family_id, email)
);

CREATE INDEX family_memberships_email_idx ON family_memberships (email);

-- Who changed which rights when; actor NULL is the BFF itself.
CREATE TABLE audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at timestamptz NOT NULL DEFAULT now(),
    actor varchar(320),
    action varchar(60) NOT NULL,
    target_type varchar(20) NOT NULL,
    target_id varchar(320) NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX audit_log_at_idx ON audit_log (at);
