-- Developers in a tree become its owners, who may also share it; creating trees is the global users.can_create_trees.
ALTER TABLE family_memberships DROP CONSTRAINT family_memberships_role_check;
UPDATE family_memberships SET role = 'owner' WHERE role = 'developer';
ALTER TABLE family_memberships ADD CONSTRAINT family_memberships_role_check CHECK (role IN ('owner', 'editor', 'visitor'));
