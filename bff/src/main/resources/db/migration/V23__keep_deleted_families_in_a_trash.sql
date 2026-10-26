-- Deleting a family only marks it; TrashPurger removes it for good after 30 days. A trashed family keeps its name and
-- slug, so neither can be reused while it is in the trash.
ALTER TABLE families
    ADD COLUMN deleted_at timestamptz,
    ADD COLUMN deleted_by varchar(320);

CREATE INDEX families_deleted_at_idx ON families (deleted_at);
