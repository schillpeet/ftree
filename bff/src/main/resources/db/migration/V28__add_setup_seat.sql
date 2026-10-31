-- Someone invited without a tree starts with an empty setup, so they hold no membership: setup_seat keeps their Cloudflare
-- Access seat until they are removed (AccessSeats.people counts it).
ALTER TABLE users
    ADD COLUMN setup_seat boolean NOT NULL DEFAULT false,
    -- The role named in the invitation; the person becomes owner of a tree they create and gets this role in trees they
    -- are invited to.
    ADD COLUMN setup_role varchar(10) CHECK (setup_role IN ('owner', 'editor', 'visitor'));
