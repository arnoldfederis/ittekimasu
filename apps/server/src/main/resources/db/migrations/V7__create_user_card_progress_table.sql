-- Per-user scheduling state for the SM-2 engine.
--
-- One row per card the user has actually reviewed. A card the user has never seen simply has
-- no row, which is what lets "new cards" fall out of a LEFT JOIN instead of needing a bulk
-- insert every time a deck is unlocked.
CREATE TABLE user_card_progress
(
    id               UUID                     NOT NULL,
    user_id          UUID                     NOT NULL,
    card_id          UUID                     NOT NULL,
    -- SM-2 ease. Starts at 2.5 and is floored at 1.3: without the floor a card the user keeps
    -- missing collapses to a review every single day and never recovers.
    ease_factor      DOUBLE PRECISION         NOT NULL DEFAULT 2.5,
    interval_days    INTEGER                  NOT NULL DEFAULT 1,
    next_review_date DATE                     NOT NULL,
    -- Consecutive non-AGAIN answers for THIS card. The user's day streak lives on users.
    streak_count     INTEGER                  NOT NULL DEFAULT 0,
    -- Only the latest review is kept, which is all the free daily cap needs: the cap counts
    -- distinct cards touched today, so answering the same card twice costs one slot.
    last_reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_user_card_progress PRIMARY KEY (id)
);

-- One row per user per card: a second review updates the row rather than appending history.
ALTER TABLE user_card_progress
    ADD CONSTRAINT uc_user_card_progress_user_card UNIQUE (user_id, card_id);

-- ON DELETE CASCADE is what makes DELETE /users/me actually remove everything, as
-- App Store review guideline 5.1.1(v) requires.
ALTER TABLE user_card_progress
    ADD CONSTRAINT fk_user_card_progress_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE user_card_progress
    ADD CONSTRAINT fk_user_card_progress_card FOREIGN KEY (card_id)
        REFERENCES cards (id) ON DELETE CASCADE;

-- Drives the due query.
CREATE INDEX idx_user_card_progress_due ON user_card_progress (user_id, next_review_date);

-- Drives the daily cap count.
CREATE INDEX idx_user_card_progress_reviewed ON user_card_progress (user_id, last_reviewed_at);

-- The study-day streak. Derived state, but not recoverable from user_card_progress: only the
-- latest review per card survives there, so a user who drills the same twenty cards daily
-- would look like they studied once. Cheaper than a review-history table and enough for the
-- flame on the learn tab.
ALTER TABLE users
    ADD COLUMN current_streak_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN longest_streak_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_studied_on     DATE;
