-- An invitation into a tree waits until the invited person accepts it: until then accepted_at is null and the membership
-- only lets them look at the tree. Memberships that exist already count as accepted when they were granted, and so do
-- the ones a person gives themselves (a tree they create) or the BFF grants (access file, creators).
ALTER TABLE family_memberships ADD COLUMN accepted_at timestamptz;

UPDATE family_memberships SET accepted_at = granted_at;
