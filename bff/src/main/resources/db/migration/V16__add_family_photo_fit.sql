ALTER TABLE families
    ADD COLUMN photo_fit varchar(10) NOT NULL DEFAULT 'cover',
    ADD CONSTRAINT families_photo_fit_check CHECK (photo_fit IN ('cover', 'original'));
