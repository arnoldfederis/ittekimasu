# Ittekimasu

A Japan relocation checklist + spaced-repetition learning app. Built for the RevenueCat Shipaton 2026 hackathon (submissions close Sep 30, 2026).

## Stack
- **Monorepo:** Turborepo — backend `apps/server`, mobile `apps/mobile`
- **Backend:** Java 25, Spring Boot 4.1.x, Maven, PostgreSQL, Spring Data JPA/Hibernate
- **Package root:** `app.ittekimasu.server`
- **Migrations:** Flyway (`ddl-auto: validate` — Hibernate NEVER generates schema)
- **Auth:** Firebase Auth issues JWT; Spring Security filter verifies via Firebase Admin SDK
- **Mobile:** Expo (React Native), Expo Router
- **Payments:** RevenueCat
- **Push:** OneSignal
- **Bundle ID:** `com.arnoldfederis.ittekimasu`

## Conventions
- Entities: classic classes + Lombok (`@Getter @Setter @NoArgsConstructor @AllArgsConstructor`). NOT records — Hibernate needs a no-args constructor and mutable fields.
- DTOs: Java records. `*Request` for inbound, `*Response` for outbound, `*Summary*` vs `*Detail*` for list vs full.
- Controllers never accept or return entities — always DTOs.
- Routes use `/users/me`, never `/users/{id}` — user resolved from the verified JWT, never from the URL.
- Validation: `@NotNull` etc. on DTOs, with `@Valid` on the controller param.
- Every schema change is a hand-written or JPA-Buddy-generated Flyway migration. Never rely on Hibernate auto-DDL.
- Timestamps: `Instant` + `@CurrentTimestamp`, columns are `TIMESTAMPTZ`.
- `open-in-view: false` in application.yml.

## Layer structure (apps/server/src/main/java/app/ittekimasu/server/)
`config/` `controller/` `service/` `repository/` `entity/` `dto/request/` `dto/response/` `exception/` `security/`

## Build gotchas (each cost real debugging time — do not undo)
- **Routes are prefixed with `/api`** by `config/WebMvcConfig`, not a servlet context path. Controllers declare `@RequestMapping("/users")`; the live route is `/api/users/me`. Keeps Scalar at `/api-docs`.
- **Lombok needs `<annotationProcessorPaths>`** in maven-compiler-plugin. JDK 23+ stopped running classpath annotation processors implicitly — without it, entities compile with no getters and every caller fails "cannot find symbol".
- **Spring Boot 4 uses Jackson 3.** Inject `tools.jackson.databind.json.JsonMapper`, never `com.fasterxml.jackson.databind.ObjectMapper` (that's only on the classpath transitively via Firebase).
- **`FirebaseTokenFilter` is NOT a `@Component`.** Boot would auto-register it as a plain servlet filter *and* it sits in the security chain; the earlier copy gets its SecurityContext wiped by `SecurityContextHolderFilter`, so valid tokens return 401. `SecurityConfig` constructs it.
- `HandlerTypePredicate` is in `org.springframework.web.method` in Spring 7 (moved from `...web.servlet.mvc.condition`).
- Migrations live in `db/migrations` (plural), set via `spring.flyway.locations`.
- `users.email` is intentionally NOT unique — Apple private relay can issue different addresses for the same person. `firebase_uid` is the identity key.

## Mobile structure (apps/mobile/)
Routes live in `src/app/` (not `app/`). Path alias `@/*` → `./src/*`.
Styling is **uniwind** (Tailwind v4 for RN) via `className`.

**Dark mode is on** and follows the system appearance — no in-app toggle.
- Colour tokens live in `src/global.css` under `@variant light { … }` and `@variant dark { … }`. Both blocks MUST declare the identical set of variable names or the uniwind bundler fails with "All themes must have the same variables". Appearance-independent tokens (type scale, radii) stay in `@theme`.
- For props that can't take a className (NativeTabs tint, StatusBar, svg fills, placeholderTextColor) call **`useThemeColors()`** from `src/constants/theme.ts` — never import a raw palette, or that value won't follow dark mode.
- `app.config.ts` sets `userInterfaceStyle: "automatic"`. Without it iOS always reports light.
- Apple's sign-in button must use the WHITE variant on dark backgrounds (HIG); see `(auth)/sign-in.tsx`.
Tabs use `NativeTabs` from `expo-router/unstable-native-tabs` (SDK 55+ syntax: `NativeTabs.Trigger.Icon`).

### Mobile libraries — use these, don't reinvent
- **Forms: `react-hook-form` + `zod` + `@hookform/resolvers/zod`.** Never hand-roll `useState` per field. Define a zod schema, pass `zodResolver`, drive inputs with `components/text-field.tsx` (which wraps `useController`). Zod v4: `z.email()`, not the deprecated `z.string().email()`. Currently unused — kept for the onboarding and settings forms in steps 2 and 6.
- **Text inputs: always `components/text-field.tsx`.** Handles the label, RHF wiring, inline error text, and a password show/hide eye toggle (`secure` prop, SF Symbols `eye`/`eye.slash`). Don't drop a bare `TextInput` into a screen.
- **Google's logo is `components/google-logo.tsx`**, the official four-colour mark as SVG paths. Google's branding guidelines forbid recolouring or substituting a glyph, so it must not be an SF Symbol or tinted.
- **Feedback: `sonner-native` via `lib/toast.ts`.** `toast.error/success/info`, or `toast.fromError(err)` which special-cases `ApiError`. Use a toast for anything that doesn't need a decision. Reserve `Alert.alert` for irreversible confirmations (delete account) — a toast can be missed.
- Toast styling lives on the `<Toaster>` in `src/app/_layout.tsx`. **`offset` must stay ≥ 64** or the toast renders under the Dynamic Island.
- The `<Toaster>` must sit inside `GestureHandlerRootView` or swipe-to-dismiss silently does nothing.
- Validation errors render **amber, never red** — same positive-reinforcement rule as the rest of the app.
- Reference for toast/animation patterns: https://github.com/emilkowalski/skills (Emil Kowalski, author of Sonner). Install as agent skills with `npx skills@latest add emilkowalski/skills`.

### OneSignal (apps/mobile/src/lib/notifications.tsx)
- **The permission prompt fires after the first completed review session, never on launch.** Asking before the app has shown any value roughly halves opt-in. An AsyncStorage flag (`notifications.prompted`) makes it once-only — iOS gives you exactly one chance at the system dialog.
- `OneSignal.login(firebaseUid)` — the **same external id as RevenueCat**, so a push campaign and a subscription event describe the same person with no lookup table between them.
- Reminder time is stored on `users.reminder_hour` + `reminder_timezone` and mirrored to OneSignal **tags**, not a scheduled push. A tag alone dies on reinstall; the row survives and the app re-applies the tag on launch. Delivery lives in a dashboard campaign targeting the `reminder_hour` segment, so copy and cadence change without an app release.
- The hour is the **user's** timezone, not `APP_ZONE`. Half these users aren't in Japan yet, and 8pm has to mean their 8pm.
- Accepting the prompt defaults the reminder to 20:00 rather than leaving it off — but a reminder nobody chose is a surprise, so the profile row makes it obvious and killable.
- Needs a **prebuild**: `onesignal-expo-plugin` adds the iOS Notification Service Extension and the `aps-environment` entitlement. Plugin `mode` follows `APP_ENV`.

### Sentry
- `initCrashReporting()` runs at **module scope** in the root layout, not in an effect — a crash during the first render is exactly what it exists to catch, and an effect runs too late.
- Disabled in dev and when `EXPO_PUBLIC_SENTRY_DSN` is blank. `sendDefaultPii: false`: nothing here needs a breadcrumb trail through someone's checklist.
- The plugin's **"Upload Debug Symbols to Sentry" phase runs on EVERY build, Debug included**, and fails the whole build if it can't resolve an org. `app.config.ts` passes `organization`/`project` (env `SENTRY_ORG`/`SENTRY_PROJECT`, defaulting to `ittekimasu`), which prebuild writes into `ios/sentry.properties`.
- Uploading also needs `SENTRY_AUTH_TOKEN`, which is a **secret** and never goes in `app.config.ts` or `.env`. Local builds skip the upload instead: use **`bun run build:ios`**, which sets `SENTRY_DISABLE_AUTO_UPLOAD=true`. For EAS, add the token with `eas env:create --name SENTRY_AUTH_TOKEN --visibility secret`.
- Never hand-edit `ios/sentry.properties` — `expo prebuild` regenerates the whole `ios/` directory and throws it away.

### RevenueCat (apps/mobile/src/lib/purchases.tsx)
- `react-native-purchases` only. **Not `react-native-purchases-ui`** — its paywall is designed in the RevenueCat dashboard, which would throw away the app's own design system and palette. The paywall here is ours.
- `Purchases.configure` runs **once per launch**, in its own effect. Re-configuring on every auth change resets cached customer info and refetches offerings for nothing. `logIn`/`logOut` is the per-user part.
- `EXPO_PUBLIC_REVENUECAT_API_KEY` is the *public* SDK key and is meant to ship in the bundle. The secret API key must never appear in the app.
- The SDK's `isPremium` is for **rendering only** — showing an unlocked deck the instant someone pays. Every gate asks the server.
- Adding it needs a dev-client rebuild: `pod install` then `xcodebuild`. Metro alone will throw "native module not found".

### Mobile build gotchas (each cost real debugging time)
- **`pod install` needs a UTF-8 locale.** Without it: `Unicode Normalization not appropriate for ASCII-8BIT`. Run `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`. This is also why `expo run:ios` fails at its pod step — build with `xcodebuild` directly when it does.
- **Never delete `ios/build` on its own** — it holds the React codegen output produced during `pod install`. If you do, re-run `pod install` before building.
- **`bunfig.toml` sets `linker = "hoisted"`.** Bun's default isolated linker makes duplicate physical copies of native modules and breaks Expo autolinking. **Any `expo install` reverts this** — re-run `bun install` from the repo root afterwards and confirm `node_modules/.bun` does not exist.
- **`bun remove` drops `"main": "expo-router/entry"`** from `apps/mobile/package.json`. Metro then fails with `Unable to resolve module ../../App`. Check it after any removal.
- **Don't add `@expo/ui`.** 57.0.12 fails to compile (`cannot find type 'PaddingValue'`), and expo-doctor will keep recommending it.
- Typed-route types regenerate only when the **dev server** runs, not on `expo export`. Route groups are stripped from hrefs: `/sign-in`, not `/(auth)/sign-in`.
- The app needs a **dev client**. `expo-apple-authentication` *is* in Expo Go, but `@react-native-google-signin/google-signin` is not — and in Expo Go the bundle ID is Expo's, so Apple's token wouldn't match the Firebase config anyway.
- **`app.config.ts`, not `app.json`.** It derives the Google `iosUrlScheme` (the reversed iOS client ID) from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Without that scheme the native SDK throws "Your app is missing support for the following URL schemes". Changing it requires `expo prebuild` + `pod install` + rebuild, not just a reload.
- **On a physical device set `EXPO_PUBLIC_API_URL` to the Mac's LAN IP.** `localhost` resolves to the phone itself; the symptom is `fetch failed: Could not connect to the server`.
- `EXPO_PUBLIC_*` is inlined at bundle time — changing `.env` needs a Metro restart (`--clear`), not a fast refresh.
- `ServerApplicationTests` is a `@SpringBootTest` and needs Postgres running (`devbox run dev up`). It fails with `Connection to pg.ittekimasu.dev:5432 refused` otherwise; the `UserControllerTest` slice has no such dependency.

### Auth flow
- **Apple and Google only — there is deliberately no email/password path.** Both providers hand back an already-verified address, so the app needs no verification screen, no password reset, and no password storage. Don't reintroduce email sign-in without also rebuilding verification and recovery.
- Sign-in is the only screen in `(auth)/`. `AuthProvider` calls `GET /users/me` on the auth-state change, which is what creates the backend row.
- Auth buttons use `size="auth"` on `Button`, which matches the label size Apple renders (43% of button height). Using the normal body size next to Apple's native button looks visibly mismatched.

## Data model
- `User` (firebase_uid unique, email, display_name)
- `ChecklistTemplate` (visa_type unique, country, purpose, display_name, japanese_name, description, is_available, sort_order) → `ChecklistTask` (category, title, default_due_offset_days, sort_order)
  - Display strings live in the DB, not the app, so adding a visa route is a migration rather than a release.
  - `is_available = false` marks a "coming soon" route: listed in the picker, greyed out, no tasks. Give it tasks to flip the flag.
  - `ChecklistTemplate.tasks` is `@OrderBy("defaultDueOffsetDays ASC, sortOrder ASC")` — chronological. Ordering by `sortOrder` alone interleaves categories, because sortOrder restarts within each one.
- `UserChecklistTask` (user, task, completed, due_date, completed_at) — unique on (user_id, task_id), `ON DELETE CASCADE` from users so `DELETE /users/me` really removes everything
  - `users.target_move_date` and `users.checklist_template_id` record what the checklist was generated from, so the profile can show them and step 6 can change them.
  - `POST /users/me/checklist` is **idempotent**: it wipes the user's existing rows first (with an explicit `flush()` before the inserts, or the unique constraint trips when Hibernate reorders them). Re-running discards completion state — the right trade for "I picked the wrong visa".
  - `ChecklistService` loads the user by id **inside its own transaction**. `UserService.findOrCreate` returns a DETACHED entity: mutating it would silently never flush, and touching its lazy `checklistTemplate` would throw with `open-in-view: false`.
  - A task belonging to someone else returns **403, not 404** — 404 would leak whether the id exists.
- `Course` (title, topic, level, description, is_premium, sort_order; unique on topic+level) → `Card` (front_text, back_text, card_type, sort_order)
  - Deliberately topic-agnostic: a course is just an ordered deck, so ward-office vocabulary or a non-Japanese topic is a seed, not a migration.
  - Card shape: front is the word as written, back is `reading · meaning` so the learner recalls the reading, not just the gloss.
  - `GET /courses` returns premium decks too, with `cardCount`. The learn tab dims them rather than hiding them — seeing what exists is what makes the paywall read as an unlock.
  - **N5 vocabulary has not been checked against an official JLPT list.** Worth a proofread before launch; spaced repetition makes a wrong reading stick.
- `UserCardProgress` (ease_factor, interval_days, next_review_date, streak_count, last_reviewed_at) — unique on (user_id, card_id)
  - A row exists only once the card has been reviewed. An unseen card is the **absence** of a row, which is why the due query is a LEFT JOIN and not a bulk insert when a deck is unlocked.
  - `streak_count` is per-card (consecutive non-AGAIN answers). The **day** streak lives on `users` — see below.
  - `last_reviewed_at` drives the free daily cap. Only the latest review per card survives, so the cap counts **distinct cards touched today**: re-rating a card you already answered today is free.
- `users.reminder_hour` (0-23, null = off) / `reminder_timezone` — the daily push reminder. See the OneSignal section for why this lives in the database rather than only as a tag.
- `users.current_streak_days` / `longest_streak_days` / `last_studied_on` — the study-day streak.
  - Not derivable from `user_card_progress` (only the latest review per card is kept, so drilling the same 20 cards daily would look like one study day). Cheaper than a review-history table.
  - A gap of two or more days restarts at **1**, not 0 — the learner did study today and the card should say so.
- `Entitlement` (is_premium, revenuecat_customer_id, expires_at, last_event_type) — one row per user, unique on user_id, written ONLY by the webhook
  - The RevenueCat **entitlement identifier is `ittekimasu_pro`** (`EntitlementService.PREMIUM_ENTITLEMENT_ID` and `lib/purchases.tsx`). Products are `monthly` and `annual` packages on the `default` offering.
  - The app calls `Purchases.logIn(firebaseUid)`, so the webhook's `app_user_id` **is the Firebase UID** — that is the whole join. Configure anonymously and skip the logIn and purchases land on an id the server cannot match to anyone.
  - `expires_at` is display-only. `is_premium` gates access, because a past expiry with no EXPIRATION event yet just means the webhook is in flight.

## Endpoints
Paths below are as declared on the controller. Every one is served under `/api` (see WebMvcConfig) — `/users/me` is really `GET /api/users/me`.

| Controller | Method | Path | Request | Response |
|---|---|---|---|---|
| UserController | GET | `/users/me` | — | `UserResponse` |
| UserController | DELETE | `/users/me` | — | 204 |
| UserController | GET | `/users/me/entitlement` | — | `EntitlementResponse` |
| UserController | PATCH | `/users/me/reminders` | `UpdateRemindersRequest` | `UserResponse` |
| ChecklistController | GET | `/templates` | query `purpose?` | `List<ChecklistTemplateSummaryResponse>` |
| ChecklistController | GET | `/templates/{visaType}` | — | `ChecklistTemplateDetailResponse` |
| ChecklistController | POST | `/users/me/checklist` | `CreateChecklistRequest` | `UserChecklistResponse` |
| ChecklistController | GET | `/users/me/checklist` | query `category?` | `UserChecklistResponse` |
| ChecklistController | PATCH | `/checklist-tasks/{taskId}` | `UpdateChecklistTaskRequest` | `UserChecklistTaskResponse` |
| CourseController | GET | `/courses` | query `topic?` | `List<CourseSummaryResponse>` |
| CourseController | GET | `/courses/{courseId}/due` | — | `DueCardsResponse` |
| ReviewController | POST | `/reviews/{cardId}` | `SubmitReviewRequest` | `ReviewResultResponse` |
| RevenueCatWebhookController | POST | `/webhooks/revenuecat` | `RevenueCatEventRequest` | 200 |

## SM-2 algorithm (SpacedRepetitionService)
```
AGAIN → interval = 1, ease -= 0.20 (floor 1.3), streak = 0
HARD  → ease -= 0.15 (floor 1.3), multiplier = 1.2
GOOD  → multiplier = ease
EASY  → ease += 0.15, multiplier = ease * 1.3

interval = (interval == 1) ? 6 : round(interval * multiplier)
nextReviewDate = today + interval days
```
New cards start at ease 2.5 and interval 1, so the first non-AGAIN answer takes the 1 → 6 jump. AGAIN skips the interval formula entirely and resets to 1, which means a lapsed card takes that jump again.

- `SpacedRepetitionService` is **pure** — no repositories, no clock, no transaction — so the algorithm is unit-testable on its own. `ReviewService` owns persistence, the daily cap, and the streak.
- Both endpoints go through `ReviewService`; `GET /courses/{id}/due` returns **due cards first (soonest first), then unseen ones**, so a backlog is cleared before new material is piled on top of it.
- Every due card carries `intervals` (what each of the four buttons would schedule). Computed server-side so the algorithm has exactly one implementation — the client must never recompute it.
- Day boundary is **`Asia/Tokyo` for everyone** (`ReviewService.APP_ZONE`), not a per-user timezone. A settings screen, not an MVP.
- Free cap is `ReviewService.FREE_DAILY_REVIEW_LIMIT = 20`, enforced server-side. Past it, `POST /reviews/{cardId}` returns **402**, which the client treats as the paywall trigger (`ApiError.requiresPremium`). A premium deck returns 402 for the same reason. Premium skips both checks — `ReviewService` asks `EntitlementService.isPremium`, never the client.
- `dailyLimit` / `reviewsRemainingToday` are **null for premium**, not a sentinel like -1: a sentinel eventually renders inside "{limit} cards a day".
- A premium session is still capped at `PREMIUM_SESSION_SIZE = 50` cards. Unlimited per day, but 500 cards in one sitting is a wall, not a session.
- `DueCardsResponse` returns counts, not just cards: empty `cards` with `reviewsRemainingToday > 0` means "nothing due", with `0` it means "allowance spent". Different copy, so the client needs to tell them apart.

## Entitlement sync (EntitlementService)
Webhook events INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE / SUBSCRIPTION_EXTENDED → `isPremium = true`.
CANCELLATION / EXPIRATION / BILLING_ISSUE / REFUND / SUBSCRIPTION_PAUSED → `isPremium = false`.
Premium is ALWAYS checked server-side from the DB, never from a client-supplied flag.
`RevenueCatEventRequest` needs `@JsonIgnoreProperties(ignoreUnknown = true)` — RevenueCat adds payload fields without warning, and a strict mapper would start 400-ing live webhooks the day they do.

- `POST /webhooks/revenuecat` is the **only unauthenticated route** in the app, so the shared secret is the entire door. It is compared with `MessageDigest.isEqual` (constant time) against `revenuecat.webhook-authorization` (env `REVENUECAT_WEBHOOK_AUTHORIZATION`).
- **Unset secret rejects everything.** Treating "unset" as "allow" would turn a missing env var in production into a free-premium endpoint that looks fine until someone finds it.
- Unknown event types and unknown `app_user_id`s are logged and **answered 200**. Any 4xx makes RevenueCat retry a payload that can never succeed, and eventually disables the webhook.
- Events whose `entitlement_ids` don't include `ittekimasu_pro` are ignored, so a second product later can't move this flag.
- After a purchase the client polls `GET /users/me/entitlement` for a few seconds (`waitForServerEntitlement`). The purchase is instant on-device but premium is decided from *our* database, so without the poll a paying user can still hit 402.

## Free vs premium
- **Free:** complete checklist for the user's own visa (all tasks), JLPT N5 deck, 20 reviews/day, streaks, reminders
- **Premium ($4.99/mo or $29.99/yr, 7-day trial):** N4 + N3 decks, unlimited reviews, extra decks (ward-office vocabulary)

## Checklist content
Categories: `VISA_IMMIGRATION`, `HOUSING`, `BANKING_MONEY`, `WORK_ADMIN`, `LANGUAGE`, `LOGISTICS`.
`defaultDueOffsetDays` is relative to the user's `targetMoveDate` (negative = before the move, positive = after arrival).
MVP ships ONE template: `ENGINEER_SPECIALIST` (技術・人文知識・国際業務).

**Task content is not verified immigration guidance.** The app must show a disclaimer pointing users to the Immigration Services Agency and their employer's HR.

## Screens (apps/mobile/src/app/)
- `(auth)/sign-in.tsx` — Apple first and most prominent, then Google. No email/password.
- `onboarding/` — `index.tsx` redirects to `purpose.tsx` → `visa.tsx` → `move-date.tsx`. The three answers live in `lib/onboarding.tsx` (provider mounted on the onboarding layout) and are submitted **once**, on the last screen — a half-written checklist on the server is worse than none.

- `onboarding/` — purpose picker → visa status picker → target move date
- `(tabs)/index.tsx` — dashboard: progress ring, up to 3 tasks due within 7 days (overdue included), streak card. Shares `lib/checklist.tsx` state with the checklist tab so an optimistic toggle updates both.
- `(tabs)/checklist.tsx` — full checklist grouped by category
- `(tabs)/learn.tsx` — streak card, active deck with progress and due count, dimmed premium decks. Refetches on focus (`useFocusEffect`), or finishing a session leaves a stale "Review 12 cards" button behind.
- `review/[courseId].tsx` — the flashcard session. A **modal, not a tab**: one task the learner starts and finishes, and the tab bar would invite them to wander out half-done.
- `(tabs)/profile.tsx` — avatar initial, plan card (free shows the cap + Upgrade, premium shows the renewal date), three stat tiles, account rows
- `paywall.tsx` — modal. Prices come from `product.priceString`, never hardcoded: already localised, and already right when App Store Connect pricing changes. Annual preselected.
- `reminder-time.tsx` — the daily reminder picker. Waking hours only (7–22), plus Off. A full 24-hour list buries the sensible choices, and nobody wants a 3am nudge.
- `settings.tsx` — manage subscription (deep-links to Apple's own screen; there is no in-app cancel), restore purchases, legal links, sign out, delete account.
  - Privacy and terms are **hosted pages**, not in-app screens — App Store Connect needs a public privacy URL to submit at all. `LEGAL_BASE_URL` must be live before submission or the links 404 into a rejection.

Design principle carried from a prior project: positive reinforcement only. No red X, no "wrong", no punitive streak loss. "Again" is a neutral scheduling signal.
- The rating buttons are **Again = neutral ink, Hard = amber, Good = green, Easy = teal**. Deliberately no red on "Again", per the palette rule in `global.css`.
- Every button shows its own interval ("Good / 6 days") rather than only a highlighted one — there is no hover state on touch, and seeing all four is what makes honest self-rating feel safe.

## Shipaton requirements
- First public release must happen during the submission window
- Published store URL, demo video under 2 min, 1024×1024 icon, screenshot at 1179×2556 (no device frame)
- Free trial must let judges test premium
- Target categories: #BuildInPublic, Peace Prize, HAMM, OneSignal's Keep Them Coming Back

## Apple requirements
- Sign in with Apple required (since Google sign-in is offered), presented at least as prominently
- In-app account deletion required → `DELETE /users/me` with cascade
- Restore purchases required
- Apple returns the user's name ONLY on first sign-in — capture it then or it's gone
