-- One row per day a user reviewed something, which the app renders as a contribution grid.
--
-- Deliberately NOT a review-history table: it stores a date and a count, never which cards
-- were answered or how. That is the cheapest thing that can answer "what does my habit look
-- like", and it is all users_card_progress cannot tell you — that table only remembers the
-- LATEST review of each card, so drilling twenty cards every day for a month leaves no trace
-- of the month.
--
-- The streak columns on `users` stay as they are: they are the hot path, read on every due
-- request, and recomputing them from this table on every read would be slower for no gain.

CREATE TABLE user_study_days
(
    id           UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- The day in Asia/Tokyo, matching ReviewService.APP_ZONE and the streak columns.
    studied_on   DATE        NOT NULL,
    -- Distinct reviews that day. Drives the shading; a day is a day either way.
    review_count INT         NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uc_user_study_days_user_day UNIQUE (user_id, studied_on)
);

-- The only read: one user's recent days, newest first.
CREATE INDEX idx_user_study_days_user_day ON user_study_days (user_id, studied_on DESC);

-- Everything that can be recovered from what was already recorded. Anyone mid-streak keeps
-- their most recent day rather than starting the grid empty; the days before it were never
-- written down and cannot be invented.
INSERT INTO user_study_days (user_id, studied_on, review_count)
SELECT id, last_studied_on, 1
FROM users
WHERE last_studied_on IS NOT NULL
ON CONFLICT (user_id, studied_on) DO NOTHING;
