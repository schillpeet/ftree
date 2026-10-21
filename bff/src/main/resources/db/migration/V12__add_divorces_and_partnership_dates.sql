-- Divorced couples, and when a couple got together and when they separated or divorced.
ALTER TABLE member_partners DROP CONSTRAINT member_partners_status_check;
ALTER TABLE member_partners
    ADD CONSTRAINT member_partners_status_check CHECK (status IN ('together', 'married', 'separated', 'divorced')),
    ADD COLUMN since date,
    ADD COLUMN ended_on date;
