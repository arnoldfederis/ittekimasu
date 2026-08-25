-- The server's own copy of what RevenueCat says about a user's subscription.
--
-- Premium is decided from THIS table, never from a flag the client sends. A jailbroken app or
-- a patched binary can claim anything; the webhook is the only writer.
CREATE TABLE entitlements
(
    id                     UUID                     NOT NULL,
    user_id                UUID                     NOT NULL,
    is_premium             BOOLEAN                  NOT NULL DEFAULT FALSE,
    -- RevenueCat's own id for the customer. Stored for support: given a user, find them in
    -- the RevenueCat dashboard without guessing.
    revenuecat_customer_id VARCHAR(255),
    -- When the current period ends. Null for a free user, and NOT authoritative on its own:
    -- an expiry in the past with is_premium still true means the EXPIRATION webhook has not
    -- arrived yet, and the app trusts is_premium.
    expires_at             TIMESTAMP WITH TIME ZONE,
    -- The last event applied, so a replayed or out-of-order webhook is traceable.
    last_event_type        VARCHAR(64),
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at             TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_entitlements PRIMARY KEY (id)
);

-- Exactly one row per user: an upsert, never a history table.
ALTER TABLE entitlements
    ADD CONSTRAINT uc_entitlements_user UNIQUE (user_id);

-- ON DELETE CASCADE is what makes DELETE /users/me actually remove everything, as
-- App Store review guideline 5.1.1(v) requires.
ALTER TABLE entitlements
    ADD CONSTRAINT fk_entitlements_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE;
