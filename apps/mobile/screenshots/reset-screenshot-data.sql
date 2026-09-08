-- Undoes seed-screenshot-data.sql: removes the fabricated study history and card progress
-- and puts the streak columns back to zero.
--
-- LOCAL ONLY.
--
--   psql -h localhost -U postgres -d ittekimasu \
--        -v email="'dev.arnoldfederis@gmail.com'" \
--        -f screenshots/reset-screenshot-data.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE reset_ctx AS
SELECT id AS user_id FROM app.users WHERE email = :email;

DELETE FROM app.user_study_days WHERE user_id = (SELECT user_id FROM reset_ctx);
DELETE FROM app.user_card_progress WHERE user_id = (SELECT user_id FROM reset_ctx);

UPDATE app.users u
SET current_streak_days = 0, longest_streak_days = 0, last_studied_on = NULL
FROM reset_ctx ctx
WHERE u.id = ctx.user_id;

COMMIT;
