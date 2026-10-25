-- The signed-in email that created the family; developers see and may delete the families they created.
-- Families from before V18 have none.
ALTER TABLE families ADD COLUMN created_by varchar(320);
