-- Partnerships are mutual: each pair is stored in both directions so either side can load it.
CREATE TABLE member_partners (
    member_id uuid NOT NULL REFERENCES members (id),
    partner_id uuid NOT NULL REFERENCES members (id),
    PRIMARY KEY (member_id, partner_id),
    CHECK (member_id <> partner_id)
);
