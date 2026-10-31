-- Every entry gets a category, so the admin page can group and filter the log and AuditLogPurger can keep content
-- changes shorter than the rest: access (rights), tree (a tree's lifecycle), content (persons in a tree), admin
-- (managing people), and system (the BFF itself). AuditLog.categoryOf derives it from the action the same way.
ALTER TABLE audit_log
    ADD COLUMN category varchar(20),
    -- The actor's users row, so filters need no email; NULL for the BFF itself or an actor without a row, and it
    -- becomes NULL when that person is deleted.
    ADD COLUMN actor_id uuid REFERENCES users (id) ON DELETE SET NULL;

UPDATE audit_log SET category = CASE
    WHEN action LIKE 'member.%' THEN 'content'
    WHEN action LIKE 'membership.%' OR action LIKE 'user.admin.%' OR action LIKE 'user.can-create-trees.%'
        OR action IN ('user.sessions.revoked', 'family.ownership.transferred') THEN 'access'
    WHEN action LIKE 'family.%' THEN 'tree'
    WHEN action LIKE 'user.%' THEN 'admin'
    ELSE 'system'
END;

UPDATE audit_log a SET actor_id = u.id FROM users u WHERE u.email = a.actor;

ALTER TABLE audit_log
    ALTER COLUMN category SET NOT NULL,
    ADD CONSTRAINT audit_log_category_check CHECK (category IN ('access', 'tree', 'content', 'admin', 'system'));

CREATE INDEX audit_log_actor_id_idx ON audit_log (actor_id, id);
CREATE INDEX audit_log_target_id_idx ON audit_log (target_id, id);
CREATE INDEX audit_log_category_idx ON audit_log (category, id);
