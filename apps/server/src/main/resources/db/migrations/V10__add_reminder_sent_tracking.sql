-- The scheduler runs every 15 minutes, so matching on "is it their reminder hour" alone
-- would fire four times inside that hour. Recording the local date of the last reminder is
-- what makes the send exactly-once per day, and it survives a restart or a redeploy in a
-- way an in-memory guard would not.
ALTER TABLE users
    ADD COLUMN last_reminded_on DATE;

-- The scheduler's only query: everyone who has actually asked for a reminder.
CREATE INDEX idx_users_reminder_hour ON users (reminder_hour) WHERE reminder_hour IS NOT NULL;
