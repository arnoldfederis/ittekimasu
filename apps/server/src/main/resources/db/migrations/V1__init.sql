CREATE SEQUENCE  IF NOT EXISTS revinfo_seq START WITH 1 INCREMENT BY 50;

CREATE TABLE revchanges (rev BIGINT NOT NULL, entityname VARCHAR(255));

CREATE TABLE revinfo (rev BIGINT NOT NULL, revtstmp BIGINT, CONSTRAINT pk_revinfo PRIMARY KEY (rev));

CREATE TABLE users (id UUID NOT NULL, firebase_uid VARCHAR(255), email VARCHAR(255), name VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE, CONSTRAINT pk_users PRIMARY KEY (id));

ALTER TABLE revchanges ADD CONSTRAINT fk_revchanges_on_default_tracking_modified_entities_changelog FOREIGN KEY (rev) REFERENCES revinfo (rev);