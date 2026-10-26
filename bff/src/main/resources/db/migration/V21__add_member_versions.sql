-- Counts the changes to a member's fields and relatives, so a save based on an older state can be rejected.
ALTER TABLE members ADD COLUMN version bigint NOT NULL DEFAULT 0;
