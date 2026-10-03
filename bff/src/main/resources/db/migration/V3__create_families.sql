CREATE TABLE families (
    id uuid NOT NULL PRIMARY KEY,
    name varchar(100) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    total_users integer,
    generation_count integer,
    min_children integer,
    max_children integer
);

INSERT INTO families (id, name)
VALUES (gen_random_uuid(), 'Familie 1');

ALTER TABLE members ADD COLUMN family_id uuid;

UPDATE members
SET family_id = (SELECT id FROM families WHERE name = 'Familie 1');

ALTER TABLE members
    ALTER COLUMN family_id SET NOT NULL,
    ADD CONSTRAINT members_family_id_fkey
        FOREIGN KEY (family_id) REFERENCES families (id);

CREATE INDEX members_family_id_idx ON members (family_id);
CREATE UNIQUE INDEX families_name_lower_idx ON families (lower(name));
