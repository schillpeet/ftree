-- A partner who died: the marriage ended with their death, which ended_on holds.
ALTER TABLE member_partners DROP CONSTRAINT member_partners_status_check;
ALTER TABLE member_partners
    ADD CONSTRAINT member_partners_status_check CHECK (status IN ('together', 'married', 'separated', 'divorced', 'widowed'));
