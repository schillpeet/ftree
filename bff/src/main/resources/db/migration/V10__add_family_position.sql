-- New families take the next sequence value, so they always sort after every reordered family.
CREATE SEQUENCE families_position_seq;

ALTER TABLE families ADD COLUMN position integer;

UPDATE families
SET position = ordered.position
FROM (
    SELECT id, row_number() OVER (ORDER BY lower(name) = 'default' DESC, created_at) - 1 AS position
    FROM families
) ordered
WHERE families.id = ordered.id;

SELECT setval('families_position_seq', (SELECT count(*) FROM families) + 1, false);

ALTER TABLE families
    ALTER COLUMN position SET DEFAULT nextval('families_position_seq'),
    ALTER COLUMN position SET NOT NULL;

ALTER SEQUENCE families_position_seq OWNED BY families.position;
