-- A slug names a family in the access file; it is made from the name once and stays when the family is renamed.
-- FamilySlugs.kt builds slugs for new families the same way.
ALTER TABLE families ADD COLUMN slug varchar(60);

WITH bases AS (
    SELECT id, position,
           coalesce(nullif(trim(BOTH '-' FROM left(regexp_replace(
               translate(
                   replace(replace(replace(replace(lower(name), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
                   'àáâãåāçćčèéêëēěìíîïīñńòóôõøōřšśùúûūůýÿžź',
                   'aaaaaaccceeeeeeiiiiinnoooooorssuuuuuyyzz'
               ),
               '[^a-z0-9]+', '-', 'g'
           ), 60)), ''), 'family') AS base
    FROM families
),
numbered AS (
    SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY position) AS n
    FROM bases
)
UPDATE families
SET slug = CASE WHEN numbered.n = 1 THEN numbered.base ELSE rtrim(left(numbered.base, 55), '-') || '-' || numbered.n END
FROM numbered
WHERE families.id = numbered.id;

ALTER TABLE families
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT families_slug_key UNIQUE (slug),
    ADD CONSTRAINT families_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
