-- Everyone who has signed in, by trimmed, lowercased email; the BFF updates last_seen at most every few minutes.
CREATE TABLE users (
    email varchar(320) NOT NULL PRIMARY KEY,
    first_seen timestamptz NOT NULL,
    last_seen timestamptz NOT NULL
);
