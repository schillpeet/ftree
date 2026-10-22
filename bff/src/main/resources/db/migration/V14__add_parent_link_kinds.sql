-- How a parent relates to the child; links that existed before are biological.
ALTER TABLE member_parents
    ADD COLUMN kind varchar(16) NOT NULL DEFAULT 'biological' CHECK (kind IN ('biological', 'adoptive', 'step', 'foster'));
