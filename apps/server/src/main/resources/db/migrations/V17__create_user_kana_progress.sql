-- The Pro backup of the kana quiz: per character, how often it was answered and how often right.
--
-- A BACKUP, not the source of truth. Every learner's progress lives on their device (free
-- included — kana is free); this table exists so a Pro subscriber's progress survives a
-- reinstall or a new phone. The app writes it once per finished or saved quiz session, never
-- per answer.
--
-- Kana is still not a deck and still not scheduled: there is no next-review date here, and
-- nothing about this table touches the SRS tables, the daily allowance or the study streak.
--
-- Keyed by the glyph as shown, which also says which script — ぢゃ and ヂャ are separate rows,
-- because they are separate things to learn to read. The server holds no kana table (the chart
-- ships in the client), so the glyph is only checked for being kana, in the request DTO.

CREATE TABLE user_kana_progress
(
    id              UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- One kana or a yōon: up to two characters today, room for three.
    glyph           VARCHAR(3)  NOT NULL,
    -- Running totals from the device. Merged with GREATEST on write (see
    -- UserKanaProgressRepository.mergeLargest), so a repeated or replayed upload never
    -- double-counts, and two devices keep the larger of each.
    correct_count   INT         NOT NULL DEFAULT 0,
    attempt_count   INT         NOT NULL DEFAULT 0,
    total_answer_ms BIGINT      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uc_user_kana_progress_user_glyph UNIQUE (user_id, glyph),
    CONSTRAINT ck_user_kana_progress_non_negative
        CHECK (correct_count >= 0 AND attempt_count >= 0 AND total_answer_ms >= 0),
    -- Holds under the GREATEST merge too: each side satisfies it, so the larger correct count
    -- can never exceed the larger attempt count.
    CONSTRAINT ck_user_kana_progress_correct_within_attempts
        CHECK (correct_count <= attempt_count)
);
