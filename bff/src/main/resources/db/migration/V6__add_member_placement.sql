-- A card either hangs from a pin (branch point computed by the UI) or sits at free coordinates.
ALTER TABLE members
    ADD COLUMN pin_id integer,
    ADD COLUMN pos_x double precision,
    ADD COLUMN pos_y double precision,
    ADD COLUMN pos_z double precision,
    ADD CONSTRAINT members_pin_id_check CHECK (pin_id >= 0),
    ADD CONSTRAINT members_position_check CHECK (
        (pos_x IS NULL AND pos_y IS NULL AND pos_z IS NULL)
        OR (pos_x IS NOT NULL AND pos_y IS NOT NULL AND pos_z IS NOT NULL)
    ),
    ADD CONSTRAINT members_placement_check CHECK (pin_id IS NULL OR pos_x IS NULL);

UPDATE members
SET pin_id = ranked.pin_id
FROM (
    SELECT id,
           row_number() OVER (
               PARTITION BY family_id ORDER BY birth_date NULLS LAST, last_name, first_name, id
           ) - 1 AS pin_id
    FROM members
) AS ranked
WHERE members.id = ranked.id;

-- At most one card per pin and family; NULL pins are distinct, so unplaced members don't collide.
CREATE UNIQUE INDEX members_family_pin_idx ON members (family_id, pin_id);
