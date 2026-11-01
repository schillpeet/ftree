-- The member of a tree a person is, kept on their membership: one person is at most one member per tree, and a member
-- at most one person. The composite foreign key keeps the member inside the membership's family; deleting the member
-- clears the link, and moving members into another family (archive) must clear their links first.
ALTER TABLE members ADD CONSTRAINT members_id_family_id_key UNIQUE (id, family_id);

ALTER TABLE family_memberships
    ADD COLUMN member_id uuid,
    ADD CONSTRAINT family_memberships_family_member_key UNIQUE (family_id, member_id),
    ADD CONSTRAINT family_memberships_member_fkey FOREIGN KEY (member_id, family_id)
        REFERENCES members (id, family_id) ON DELETE SET NULL (member_id);
