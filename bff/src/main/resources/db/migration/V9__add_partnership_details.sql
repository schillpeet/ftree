-- Both rows of a pair carry the same details; MemberService keeps them in sync.
ALTER TABLE member_partners
    ADD COLUMN status varchar(16) NOT NULL DEFAULT 'together' CHECK (status IN ('together', 'married')),
    ADD COLUMN married_on date;
