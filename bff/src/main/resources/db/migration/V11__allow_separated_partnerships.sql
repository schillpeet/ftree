-- A couple who split up: the partners stay linked, so shared children keep both parents.
ALTER TABLE member_partners DROP CONSTRAINT member_partners_status_check;
ALTER TABLE member_partners
    ADD CONSTRAINT member_partners_status_check CHECK (status IN ('together', 'married', 'separated'));
