-- Users are created transparently on first authenticated request (UserService.findOrCreate).
-- There is no separate registration endpoint: Firebase Auth owns signup and credentials.
CREATE TABLE users
(
    id           UUID                     NOT NULL,
    firebase_uid VARCHAR(128)             NOT NULL,
    email        VARCHAR(255)             NOT NULL,
    -- Nullable on purpose: Apple only returns the user's name on the very first sign-in,
    -- and email/password signups have no name at all.
    display_name VARCHAR(255),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id)
);

-- firebase_uid is the only identity key. email is deliberately NOT unique: Apple's
-- private relay can hand out a different address for the same human, and a unique
-- violation there would hard-fail an otherwise valid sign-in.
ALTER TABLE users
    ADD CONSTRAINT uc_users_firebase_uid UNIQUE (firebase_uid);
