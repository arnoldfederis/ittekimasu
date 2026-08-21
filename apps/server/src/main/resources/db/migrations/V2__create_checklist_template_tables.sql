-- Reference data: the pre-built checklists a user can adopt at onboarding.
-- Nothing here is per-user; V4 adds the table that tracks a user's own copy.
CREATE TABLE checklist_templates
(
    id            UUID                     NOT NULL,
    visa_type     VARCHAR(64)              NOT NULL,
    country       VARCHAR(2)               NOT NULL,
    purpose       VARCHAR(32)              NOT NULL,
    -- Display fields live here rather than in the app so a new template needs no release.
    display_name  VARCHAR(120)             NOT NULL,
    japanese_name VARCHAR(120),
    description   VARCHAR(255),
    -- False for templates that are listed but have no tasks yet. The onboarding picker
    -- shows them greyed out as "coming soon" — seeing what exists is better than a list
    -- with one entry.
    is_available  BOOLEAN                  NOT NULL DEFAULT FALSE,
    sort_order    INTEGER                  NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_checklist_templates PRIMARY KEY (id)
);

ALTER TABLE checklist_templates
    ADD CONSTRAINT uc_checklist_templates_visa_type UNIQUE (visa_type);

CREATE TABLE checklist_tasks
(
    id                      UUID                     NOT NULL,
    template_id             UUID                     NOT NULL,
    category                VARCHAR(32)              NOT NULL,
    title                   VARCHAR(200)             NOT NULL,
    -- Relative to the user's target move date: negative is before the move, positive is
    -- after arrival. This is what turns one date into ~20 real deadlines.
    default_due_offset_days INTEGER                  NOT NULL,
    sort_order              INTEGER                  NOT NULL DEFAULT 0,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_checklist_tasks PRIMARY KEY (id)
);

ALTER TABLE checklist_tasks
    ADD CONSTRAINT fk_checklist_tasks_template FOREIGN KEY (template_id)
        REFERENCES checklist_templates (id) ON DELETE CASCADE;

CREATE INDEX idx_checklist_tasks_template ON checklist_tasks (template_id, sort_order);
