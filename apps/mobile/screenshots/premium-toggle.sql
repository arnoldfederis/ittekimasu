-- Unlocks (or re-locks) Ittekimasu Pro on a LOCAL DEV account, so the premium decks can be
-- photographed without going through a StoreKit purchase.
--
-- Premium is read from this table on every gated request — the RevenueCat SDK flag only
-- covers the seconds between paying and the webhook landing — so flipping is_premium here is
-- exactly what the webhook would have done.
--
-- ORDER MATTERS when shooting the gallery: the paywall and the free-plan card only exist
-- while this is false. Shoot every free-plan slide first, flip to true for the Ward Office
-- slide, then flip back.
--
--   psql -h localhost -U postgres -d ittekimasu \
--        -v email="'dev.arnoldfederis@gmail.com'" -v premium=true \
--        -f screenshots/premium-toggle.sql
--
-- LOCAL ONLY.

\set ON_ERROR_STOP on

INSERT INTO app.entitlements (id, user_id, is_premium, last_event_type, created_at, updated_at)
SELECT gen_random_uuid(), u.id, :premium, 'MANUAL_SCREENSHOT_TOGGLE', now(), now()
FROM app.users u
WHERE u.email = :email
ON CONFLICT (user_id) DO UPDATE
  SET is_premium = EXCLUDED.is_premium,
      last_event_type = EXCLUDED.last_event_type,
      updated_at = now();

SELECT u.email, e.is_premium
FROM app.entitlements e
JOIN app.users u ON u.id = e.user_id
WHERE u.email = :email;
