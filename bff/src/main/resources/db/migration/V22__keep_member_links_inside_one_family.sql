-- Parent and partner links only ever connect members of the same family; the services enforce it, this keeps the
-- database from storing anything else. Existing rows that break the rule must be fixed by hand first.
DO $$
DECLARE
    broken integer;
BEGIN
    SELECT (SELECT count(*) FROM member_parents p
                JOIN members c ON c.id = p.child_id JOIN members a ON a.id = p.parent_id
                WHERE c.family_id <> a.family_id)
         + (SELECT count(*) FROM member_partners p
                JOIN members m ON m.id = p.member_id JOIN members a ON a.id = p.partner_id
                WHERE m.family_id <> a.family_id)
    INTO broken;
    IF broken > 0 THEN
        RAISE EXCEPTION 'Cannot add the family check: % parent/partner link(s) connect members of different families. '
            'Delete them from member_parents / member_partners and run the migration again.', broken;
    END IF;
END $$;

CREATE FUNCTION check_link_in_one_family() RETURNS trigger AS $$
DECLARE
    first_id uuid;
    second_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'member_parents' THEN
        first_id := NEW.child_id;
        second_id := NEW.parent_id;
    ELSE
        first_id := NEW.member_id;
        second_id := NEW.partner_id;
    END IF;
    IF (SELECT family_id FROM members WHERE id = first_id) IS DISTINCT FROM (SELECT family_id FROM members WHERE id = second_id) THEN
        RAISE EXCEPTION 'members % and % belong to different families', first_id, second_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER member_parents_one_family BEFORE INSERT OR UPDATE ON member_parents
    FOR EACH ROW EXECUTE FUNCTION check_link_in_one_family();
CREATE TRIGGER member_partners_one_family BEFORE INSERT OR UPDATE ON member_partners
    FOR EACH ROW EXECUTE FUNCTION check_link_in_one_family();
