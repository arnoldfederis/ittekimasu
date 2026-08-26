-- When the user wants their daily nudge.
--
-- Stored server-side rather than only as a OneSignal tag: a tag lives on the subscription
-- record, so reinstalling the app or switching phones silently loses the setting. This row
-- outlives both, and the app re-applies the tag from it on every launch.
ALTER TABLE users
    -- 0-23 in the user's own timezone. NULL means reminders are off, which is the default:
    -- a daily push nobody asked for is how an app gets its notifications muted for good.
    ADD COLUMN reminder_hour     SMALLINT,
    -- IANA zone, e.g. Asia/Tokyo. Needed because the reminder fires at the user's 8pm, not
    -- the server's — and half this app's users are not in Japan yet.
    ADD COLUMN reminder_timezone VARCHAR(64);

ALTER TABLE users
    ADD CONSTRAINT ck_users_reminder_hour CHECK (reminder_hour IS NULL OR reminder_hour BETWEEN 0 AND 23);
