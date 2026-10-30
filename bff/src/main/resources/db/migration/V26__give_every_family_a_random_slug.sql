-- Slugs made from the name (V17) put the family name into every URL; every family now gets a random one like new
-- families do (FamilySlugs.kt): 10 lowercase letters and digits. Old URLs then show "Baum nicht gefunden".
-- The subquery refers to the row, so each family gets its own slug; families_slug_key catches a collision.
UPDATE families
SET slug = (
    SELECT string_agg(substr('abcdefghijklmnopqrstuvwxyz0123456789', 1 + floor(random() * 36)::int, 1), '')
    FROM generate_series(1, 10)
    WHERE families.id IS NOT NULL
);
