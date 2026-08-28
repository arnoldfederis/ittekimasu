-- Lets a learner take back the answer they just gave.
--
-- Four rating buttons sit side by side under a thumb, and a mis-tap permanently rewrites a
-- card's schedule: tap Easy on a card you did not know and it disappears for weeks. There
-- was no way back, and the app cannot ask "are you sure?" on the one control it wants people
-- pressing without hesitation.
--
-- The snapshot is the previous state of THIS row, written on every review. One step of undo
-- is all this needs — the mis-tap is noticed immediately or not at all — so an audit table
-- would be storage and complexity for a button nobody presses twice.

ALTER TABLE user_card_progress
    ADD COLUMN last_rating             VARCHAR(16),
    ADD COLUMN previous_ease_factor    DOUBLE PRECISION,
    ADD COLUMN previous_interval_days  INT,
    ADD COLUMN previous_streak_count   INT,
    ADD COLUMN previous_next_review_date DATE,
    ADD COLUMN previous_last_reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN user_card_progress.last_rating IS
    'The most recent answer (AGAIN/HARD/GOOD/EASY). Null for rows written before V15.';
COMMENT ON COLUMN user_card_progress.previous_last_reviewed_at IS
    'Null means the review being undone was the FIRST for this card, so undo deletes the row rather than restoring it.';
