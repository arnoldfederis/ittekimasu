-- Records that a user finished onboarding, independently of whether they built a checklist.
--
-- Until now "has this person onboarded?" was answered by counting their checklist tasks,
-- which makes a checklist compulsory: someone who only wants to learn Japanese has nothing
-- to count, so every launch drops them back into the visa picker. This column is the fact
-- the client actually needs, and it survives a reinstall the way a device flag would not.

ALTER TABLE users
    ADD COLUMN onboarded_at TIMESTAMPTZ;

COMMENT ON COLUMN users.onboarded_at IS
    'When onboarding was completed. Null means the user has not finished it. Set both by adopting a checklist template and by choosing the study-only path.';

-- Everyone who already adopted a template finished onboarding under the old rule. Without
-- this backfill every existing user would be sent through onboarding again on next launch.
UPDATE users
SET onboarded_at = created_at
WHERE checklist_template_id IS NOT NULL;
