CREATE TABLE members (
    id uuid NOT NULL PRIMARY KEY,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    birth_date date,
    birth_place varchar(200),
    death_date date,
    death_place varchar(200),
    note varchar(5000),
    photo_url varchar(2048)
);

CREATE TABLE member_parents (
    child_id uuid NOT NULL REFERENCES members (id),
    parent_id uuid NOT NULL REFERENCES members (id),
    PRIMARY KEY (child_id, parent_id)
);
