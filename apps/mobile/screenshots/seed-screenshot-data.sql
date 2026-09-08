-- Fills a LOCAL DEV account with enough history to photograph.
--
-- The study grid, the streak and the "cards learned" tile all read from real rows, so an
-- account made five minutes ago photographs as an empty product. Setting users.current_streak_days
-- on its own is not enough: the grid is drawn from user_study_days, and the tile counts
-- user_card_progress. Seed all three or the profile slide contradicts itself — a 365-day
-- streak next to "0 cards learned" is the sort of detail a reviewer notices.
--
-- LOCAL ONLY. This writes fabricated history. Never point it at production.
--
--   psql -h localhost -U postgres -d ittekimasu \
--        -v email="'dev.arnoldfederis@gmail.com'" \
--        -f screenshots/seed-screenshot-data.sql
--
-- Undo: screenshots/reset-screenshot-data.sql, or "Start learning over" in the app's
-- Settings (which clears progress, streak and study days together).

\set ON_ERROR_STOP on

BEGIN;

-- Asia/Tokyo, because ReviewService.APP_ZONE decides what "today" means for every one of
-- these columns. Seeding in local time puts the last square a day out.
CREATE TEMP TABLE seed_ctx AS
SELECT
  id AS user_id,
  (now() AT TIME ZONE 'Asia/Tokyo')::date AS today
FROM app.users
WHERE email = :email;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seed_ctx) THEN
    RAISE EXCEPTION 'No user with that email. Sign in on the simulator first.';
  END IF;
END $$;

DELETE FROM app.user_study_days WHERE user_id = (SELECT user_id FROM seed_ctx);

/*
 * 20 weeks back, which is exactly what StudyGrid renders (WEEKS = 20).
 *
 * The pattern matters more than the density. A solid block of 140 squares looks generated;
 * real study history has ragged edges and one holiday-shaped hole. The last 14 days are
 * unbroken so the streak caption is true, everything older is ~60% with a deliberate six-day
 * gap around nine weeks ago.
 *
 * review_count is spread across StudyGrid's four intensity buckets (<5, <15, <30, 30+) so
 * the grid has light and dark squares. A grid where every square is the same green reads as
 * a placeholder.
 */
INSERT INTO app.user_study_days (id, user_id, studied_on, review_count, created_at)
SELECT
  gen_random_uuid(),
  ctx.user_id,
  day::date,
  CASE
    WHEN random() < 0.12 THEN 30 + (random() * 12)::int   -- the occasional long session
    WHEN random() < 0.30 THEN 3 + (random() * 3)::int     -- a quick five minutes
    ELSE 7 + (random() * 16)::int
  END,
  (day + time '20:30') AT TIME ZONE 'Asia/Tokyo'
FROM seed_ctx ctx
CROSS JOIN generate_series(ctx.today - 139, ctx.today, '1 day') AS day
WHERE
  -- The current streak: unbroken.
  day::date > ctx.today - 14
  OR (
    -- Older history, with one deliberate week off.
    day::date NOT BETWEEN ctx.today - 68 AND ctx.today - 63
    AND random() < 0.6
  );

UPDATE app.users u
SET
  current_streak_days = 14,
  longest_streak_days = 23,
  last_studied_on = ctx.today
FROM seed_ctx ctx
WHERE u.id = ctx.user_id;

/*
 * Cards. Free decks only — a seeded premium card would unlock nothing but would make the
 * "cards learned" count disagree with what the locked decks say.
 *
 * created_at is backdated on purpose: ReviewService counts progress rows CREATED TODAY
 * against NEW_CARDS_PER_DAY, so seeding 45 rows dated today would tell the app you had
 * already met your new-card allowance and the learn tab would offer nothing.
 */
DELETE FROM app.user_card_progress WHERE user_id = (SELECT user_id FROM seed_ctx);

INSERT INTO app.user_card_progress (
  id, user_id, card_id,
  ease_factor, interval_days, next_review_date, streak_count,
  last_reviewed_at, last_rating,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  ctx.user_id,
  picked.id,
  -- Ease drifts around the 2.5 a new card starts at.
  round((2.20 + random() * 0.55)::numeric, 2),
  picked.interval_days,
  ctx.today + picked.due_in,
  1 + (random() * 4)::int,
  (ctx.today - picked.interval_days + time '20:30') AT TIME ZONE 'Asia/Tokyo',
  picked.rating,
  (ctx.today - 30 - (random() * 60)::int + time '20:30') AT TIME ZONE 'Asia/Tokyo',
  (ctx.today - picked.interval_days + time '20:30') AT TIME ZONE 'Asia/Tokyo'
FROM seed_ctx ctx
CROSS JOIN LATERAL (
  SELECT
    c.id,
    row_number() OVER (ORDER BY co.sort_order, c.sort_order) AS n,
    /*
     * The first 12 come due today or are already overdue, so the learn tab has a real
     * number on its button and the review session has cards to photograph. The rest are
     * scheduled ahead, which is what makes the deck look lived-in rather than untouched.
     */
    CASE WHEN row_number() OVER (ORDER BY co.sort_order, c.sort_order) <= 12
         THEN -(random() * 2)::int
         ELSE 1 + (random() * 20)::int
    END AS due_in,
    CASE WHEN row_number() OVER (ORDER BY co.sort_order, c.sort_order) <= 12
         THEN 1 + (random() * 5)::int
         ELSE 6 + (random() * 18)::int
    END AS interval_days,
    (ARRAY['GOOD', 'GOOD', 'GOOD', 'EASY', 'HARD', 'AGAIN'])[1 + (random() * 5)::int] AS rating
  FROM app.cards c
  JOIN app.courses co ON co.id = c.course_id
  WHERE co.is_premium = false
  ORDER BY co.sort_order, c.sort_order
  LIMIT 45
) picked;

COMMIT;

SELECT
  (SELECT count(*) FROM app.user_study_days d JOIN seed_ctx c ON d.user_id = c.user_id) AS study_days,
  (SELECT count(*) FROM app.user_card_progress p JOIN seed_ctx c ON p.user_id = c.user_id) AS cards_learned,
  (SELECT count(*) FROM app.user_card_progress p JOIN seed_ctx c ON p.user_id = c.user_id
    WHERE p.next_review_date <= c.today) AS due_now,
  (SELECT current_streak_days FROM app.users u JOIN seed_ctx c ON u.id = c.user_id) AS streak;
