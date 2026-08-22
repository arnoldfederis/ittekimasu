-- The user's own copy of a template. Adopting a template snapshots its tasks so later edits
-- to the reference data never silently rewrite someone's in-progress checklist.

-- Which template the user adopted, and the date every due_date was computed from. Kept on
-- the user so the profile screen can show them and step 6 can let the user change them.
ALTER TABLE users
    ADD COLUMN target_move_date      DATE,
    ADD COLUMN checklist_template_id UUID;

ALTER TABLE users
    ADD CONSTRAINT fk_users_checklist_template FOREIGN KEY (checklist_template_id)
        REFERENCES checklist_templates (id);

CREATE TABLE user_checklist_tasks
(
    id           UUID                     NOT NULL,
    user_id      UUID                     NOT NULL,
    task_id      UUID                     NOT NULL,
    completed    BOOLEAN                  NOT NULL DEFAULT FALSE,
    -- target_move_date + the template task's default_due_offset_days.
    due_date     DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_user_checklist_tasks PRIMARY KEY (id)
);

-- One row per user per template task: makes re-adopting a template idempotent.
ALTER TABLE user_checklist_tasks
    ADD CONSTRAINT uc_user_checklist_tasks_user_task UNIQUE (user_id, task_id);

-- ON DELETE CASCADE is what makes DELETE /users/me actually remove everything, as
-- App Store review guideline 5.1.1(v) requires.
ALTER TABLE user_checklist_tasks
    ADD CONSTRAINT fk_user_checklist_tasks_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE user_checklist_tasks
    ADD CONSTRAINT fk_user_checklist_tasks_task FOREIGN KEY (task_id)
        REFERENCES checklist_tasks (id) ON DELETE CASCADE;

CREATE INDEX idx_user_checklist_tasks_user ON user_checklist_tasks (user_id, due_date);
