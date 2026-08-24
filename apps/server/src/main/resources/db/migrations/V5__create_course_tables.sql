-- Reference data for the spaced-repetition engine. Deliberately topic-agnostic: a course is
-- just an ordered deck of cards, so the same engine can carry ward-office vocabulary or a
-- non-Japanese topic later without a schema change.
CREATE TABLE courses
(
    id          UUID                     NOT NULL,
    title       VARCHAR(120)             NOT NULL,
    -- Broad subject, e.g. JLPT. Kept free-form so a new topic is a seed, not a migration.
    topic       VARCHAR(64)              NOT NULL,
    -- Level within the topic, e.g. N5. Null for courses that have no ladder.
    level       VARCHAR(32),
    description VARCHAR(255),
    -- Premium is ALWAYS decided here and checked server-side, never from a client flag.
    is_premium  BOOLEAN                  NOT NULL DEFAULT FALSE,
    sort_order  INTEGER                  NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_courses PRIMARY KEY (id)
);

ALTER TABLE courses
    ADD CONSTRAINT uc_courses_topic_level UNIQUE (topic, level);

CREATE TABLE cards
(
    id         UUID                     NOT NULL,
    course_id  UUID                     NOT NULL,
    -- What the learner sees first: the word in kanji or kana.
    front_text VARCHAR(255)             NOT NULL,
    -- The answer: reading, then meaning.
    back_text  VARCHAR(500)             NOT NULL,
    card_type  VARCHAR(32)              NOT NULL,
    sort_order INTEGER                  NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_cards PRIMARY KEY (id)
);

ALTER TABLE cards
    ADD CONSTRAINT fk_cards_course FOREIGN KEY (course_id)
        REFERENCES courses (id) ON DELETE CASCADE;

CREATE INDEX idx_cards_course ON cards (course_id, sort_order);
