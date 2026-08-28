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
- **A seed migration must never insert an enum value the Java enum lacks.** `cards.card_type` is a plain VARCHAR with no check constraint, so `'KANA'` inserted happily and then blew up at READ time when Hibernate could not map it — taking out `GET /courses/{id}/due` for the whole deck. Add the constant to `CardType` in the same change as the seed.
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

### Data layer — TanStack Query (apps/mobile/src/lib/queries.ts, query-client.ts)
- **Every read goes through React Query.** No screen calls `api.*` directly for a fetch. Keys and `queryOptions` factories live in `lib/queries.ts`, so the learn tab, the profile tab and the notifications provider share ONE `GET /users/me` instead of three.
- `lib/api/` is split into `client.ts` (transport, `ApiError`, `NotSignedInError`), `endpoints.ts`, `types.ts`, with an `index.ts` barrel — `@/lib/api` still resolves everywhere.
- Failures toast in exactly one place (`QueryCache`/`MutationCache` `onError`), with per-query copy via `meta.errorMessage` and `meta.silent`. **402 and `NotSignedInError` never toast**: the first means "open the paywall", the second means the session just ended on purpose.
- Retry skips every 4xx. Retrying a 402 would delay the paywall for nothing.
- `queryClient.clear()` + `clearPersistedCache()` on sign-out. On a shared phone the next account would otherwise see the previous one's checklist — and the on-disk copy would survive a relaunch.
- Providers (`useChecklist`, `usePurchases`, `useNotifications`) kept their public APIs; the query lives inside them, so screens did not churn.

### Offline (apps/mobile/src/lib/network.ts)
- **`expo-network` drives `onlineManager`.** Without it React Query assumes always-online, fires into a dead socket, and the raw "The internet connection appears to be offline" reaches the user as a toast. Uses `isInternetReachable`, not `isConnected` — plane wifi and captive portals report connected while nothing gets through.
- The cache is **persisted to AsyncStorage** (7 days, `gcTime` matched to it, `buster` to throw it away after a response-shape change). Entitlement is excluded: premium is re-read from the server every launch and gates nothing on its own.
- **Ratings given offline are queued, not lost**: `networkMode: "online"` (the DEFAULT — never `offlineFirst`, which fires the request anyway and only pauses the retries, so with `retry: false` it just errors and the answer is lost) plus a mutationFn registered through `setMutationDefaults(REVIEW_MUTATION_KEY)`, which is what lets a rating replay after the app has been killed and relaunched. The review screen advances the card in `onMutate`, never `onSuccess` — offline that never fires and the session would freeze on card one.
- **The server timestamps a review when it SYNCS, not when it was answered.** A plane session that uploads next morning counts toward that day's cap and streak (`ReviewService.APP_ZONE` is Asia/Tokyo). Fixing it properly means accepting a client `reviewedAt`.
- Over-answering offline on the free plan gets 402s on replay. Those are silent everywhere else, so replayed rejections raise one throttled notice — otherwise the work vanishes without a word.
- **Screens that exist only to write are unreachable offline**: the profile rows for /move-date and /reminder-time are disabled, because a page whose every control is greyed out is worse than a door that does not open. The controls inside them are gated too, for the connection that drops while the screen is open. Same for the checklist wizard's final step and the study-only card. A paused mutation neither fails nor completes, so without this the button spins forever and the setting looks saved when the server never heard about it.
- A paused query is NOT loading: it never resolves offline, so screens check `fetchStatus === "paused"` and show "not saved on this device yet" instead of a spinner that runs forever.

### OneSignal (apps/mobile/src/lib/notifications.tsx)
- **The permission prompt fires after the first completed review session, never on launch.** Asking before the app has shown any value roughly halves opt-in. An AsyncStorage flag (`notifications.prompted`) makes it once-only — iOS gives you exactly one chance at the system dialog.
- `OneSignal.login(firebaseUid)` — the **same external id as RevenueCat**, so a push campaign and a subscription event describe the same person with no lookup table between them.
- Reminder time is stored on `users.reminder_hour` + `reminder_timezone` and mirrored to OneSignal **tags**, not a scheduled push. A tag alone dies on reinstall; the row survives and the app re-applies the tag on launch. Delivery lives in a dashboard campaign targeting the `reminder_hour` segment, so copy and cadence change without an app release.
- The hour is the **user's** timezone, not `APP_ZONE`. Half these users aren't in Japan yet, and 8pm has to mean their 8pm.
- Accepting the prompt defaults the reminder to 20:00 rather than leaving it off — but a reminder nobody chose is a surprise, so the profile row makes it obvious and killable.
- Needs a **prebuild**: `onesignal-expo-plugin` adds the iOS Notification Service Extension and the `aps-environment` entitlement. Plugin `mode` follows `APP_ENV`.

### Speech (apps/mobile/src/lib/speech.ts)
- **Voice selection needs no network.** `Speech.getAvailableVoicesAsync()` reads what iOS already has installed; the Enhanced/Premium voices are downloaded by the user in iOS Settings, never by the app.
- **Any screen that speaks must call `applyAudioMode()` on mount.** AVAudioSession is process-wide and only written by `setPlaysInSilentMode`, so on a fresh launch a screen inherits whatever category iOS defaulted to — previews stayed muted by the ring switch even with the preference already ON, on the one screen whose job is auditioning voices.

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
  - **No deck has been checked against an official JLPT list** (V6 seeds N5, V13 seeds N4/N3/Ward Office). Worth a proofread by a native or advanced speaker before launch; spaced repetition makes a wrong reading stick. The seeds are verified only for structure: contiguous ordering, unique fronts within a deck, and no word repeated ACROSS decks — re-teaching an N5 word at N4 is the sloppiness that gets noticed.
  - The Ward Office deck is the app's differentiator and its riskiest content: it is vocabulary, NOT immigration guidance, and the same disclaimer as the checklist applies.
  - **Hiragana and Katakana (104 cards each) are free and sort first.** The N5 deck writes its readings in hiragana, so it silently assumed the learner could already read kana — that was the app's real starting wall. 46 gojūon + 25 dakuten/handakuten + 33 yōon per script. Excluded on purpose: the katakana long-vowel mark ー and extended foreign-sound combos (ファ, ティ), neither of which works as a standalone card with a spoken answer.
  - Kana cards break the `reading · meaning` shape: front is the character, back is romaji, `card_type = 'KANA'`. A kana IS its reading. `speech.ts` therefore speaks the **front** when the back has no `·` (`spokenTextOf`), or a Japanese voice would read "shi" as English.
- `UserCardProgress` (ease_factor, interval_days, next_review_date, streak_count, last_reviewed_at) — unique on (user_id, card_id)
  - A row exists only once the card has been reviewed. An unseen card is the **absence** of a row, which is why the due query is a LEFT JOIN and not a bulk insert when a deck is unlocked.
  - `streak_count` is per-card (consecutive non-AGAIN answers). The **day** streak lives on `users` — see below.
  - `last_reviewed_at` drives the free daily cap. Only the latest review per card survives, so the cap counts **distinct cards touched today**: re-rating a card you already answered today is free.
- `users.onboarded_at` — when onboarding finished, null until it has. **NOT** the same as having a checklist: someone on the study-only path is onboarded with zero tasks. `UserResponse.onboarded` is what the client routes on; counting checklist tasks (the old rule) made a checklist compulsory and trapped language-only users in the visa picker forever. Set by adopting a template AND by `POST /users/me/onboarding`, never overwritten once set.
- `users.reminder_hour` (0-23, null = off) / `reminder_timezone` — the daily push reminder. See the OneSignal section for why this lives in the database rather than only as a tag.
- `UserStudyDay` (user, studied_on, review_count) — one row per day studied, unique on (user_id, studied_on). Drives the profile's contribution grid.
  - NOT a review-history table: a date and a count, never which cards or how they were rated. `user_card_progress` cannot answer this — it keeps only the LATEST review of each card, so a month of daily drilling leaves no trace of the month.
  - Written by a **native upsert** (`ON CONFLICT DO UPDATE`), not read-then-write: two reviews in the same instant would both see "no row yet" and the second insert would trip the unique constraint.
  - The streak columns on `users` stay authoritative — they are read on every due request, and recomputing them from this table would be slower for nothing.
  - Backfilled in V14 from `last_studied_on`, which is the only day that was ever recorded. Earlier days cannot be invented.
- `users.current_streak_days` / `longest_streak_days` / `last_studied_on` — the study-day streak.
  - **A day with nothing due does not break it.** A first non-AGAIN answer schedules a card six days out, so clearing a deck buys days of enforced silence — resetting the streak for that is the algorithm punishing its own success, and the app's whole design principle is no punitive streak loss. `ReviewService.studyGapWasEmpty` decides, and it must be read BEFORE the review is saved: saving reschedules the card being answered and erases the evidence that it was overdue.
  - It still only advances when the user actually reviews something, so a six-day gap with nothing due yields +1, not +6. These are study days, not calendar days.
  - "Accessible decks" means free-only for a free user. A locked premium deck is not work they skipped.
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
| UserController | POST | `/users/me/onboarding` | — | `UserResponse` |
| UserController | GET | `/users/me/study-days` | — | `List<StudyDayResponse>` |
| UserController | GET | `/users/me/cards` | — | `List<SeenCardResponse>` |
| UserController | DELETE | `/users/me/cards/{cardId}` | — | 204 |
| UserController | PATCH | `/users/me/cards` | `BulkRatingRequest` | `BulkCardsResponse` |
| UserController | DELETE | `/users/me/cards` | query `courseId?` | `BulkCardsResponse` |
| UserController | DELETE | `/users/me/progress` | — | `BulkCardsResponse` |
| ChecklistController | GET | `/templates` | query `purpose?` | `List<ChecklistTemplateSummaryResponse>` |
| ChecklistController | GET | `/templates/{visaType}` | — | `ChecklistTemplateDetailResponse` |
| ChecklistController | POST | `/users/me/checklist` | `CreateChecklistRequest` | `UserChecklistResponse` |
| ChecklistController | GET | `/users/me/checklist` | query `category?` | `UserChecklistResponse` |
| ChecklistController | PATCH | `/checklist-tasks/{taskId}` | `UpdateChecklistTaskRequest` | `UserChecklistTaskResponse` |
| CourseController | GET | `/courses` | query `topic?` | `List<CourseSummaryResponse>` |
| CourseController | GET | `/courses/{courseId}/due` | — | `DueCardsResponse` |
| ReviewController | POST | `/reviews/{cardId}` | `SubmitReviewRequest` | `ReviewResultResponse` |
| ReviewController | DELETE | `/reviews/{cardId}` | — | 204 |
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
- **`NEW_CARDS_PER_DAY = 10` paces FIRST-TIME cards across every deck — premium included.** Not a paywall: a hundred unfamiliar characters in one sitting is cramming, and without it a 104-card deck is exhausted in an afternoon, leaving the app nothing to offer for the six days SM-2 then imposes. Reviews are untouched — everything due comes back the day it is due, and due cards fill a session BEFORE new ones, because burying a backlog under new words is how a deck becomes unmanageable.
  - Counted as "progress rows created today": a row is created the first time a card is answered, so its creation date IS the day the card became seen. No column to keep in step.
  - `DueCardsResponse.newCardsRemainingToday` + `unseenCardCount` let the client tell **paced** from **finished**. Without both, the learn tab says "All caught up" over ninety cards the learner has never seen.
  - `hasWorkAvailable` respects it too, or the daily reminder would nudge someone towards cards the app has already decided to withhold until tomorrow.
- Free cap is `ReviewService.FREE_DAILY_REVIEW_LIMIT = 20`, enforced server-side. Past it, `POST /reviews/{cardId}` returns **402**, which the client treats as the paywall trigger (`ApiError.requiresPremium`). A premium deck returns 402 for the same reason. Premium skips both checks — `ReviewService` asks `EntitlementService.isPremium`, never the client.
- `dailyLimit` / `reviewsRemainingToday` are **null for premium**, not a sentinel like -1: a sentinel eventually renders inside "{limit} cards a day".
- A premium session is still capped at `PREMIUM_SESSION_SIZE = 50` cards. Unlimited per day, but 500 cards in one sitting is a wall, not a session.
- `DueCardsResponse` returns counts, not just cards: empty `cards` with `reviewsRemainingToday > 0` means "nothing due", with `0` it means "allowance spent". Different copy, so the client needs to tell them apart.
- It also carries **`nextDueDate`** (the soonest scheduled card in THAT deck). Without it "All caught up" reads as "this deck is finished" — the learn tab says "back in 6 days" and the finish screen names the day. Spaced repetition is the product; the silence between sessions has to be explained, not just imposed.

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
- **Free:** complete checklist for the user's own visa (all tasks), Hiragana + Katakana + JLPT N5 decks, 20 reviews/day, streaks, reminders
- **Premium ($4.99/mo or $29.99/yr, 7-day trial):** JLPT N4 (100) + N3 (100) + Ward Office (55) decks, unlimited reviews

## Checklist content
Categories: `VISA_IMMIGRATION`, `HOUSING`, `BANKING_MONEY`, `WORK_ADMIN`, `LANGUAGE`, `LOGISTICS`.
`defaultDueOffsetDays` is relative to the user's `targetMoveDate` (negative = before the move, positive = after arrival).
MVP ships ONE template: `ENGINEER_SPECIALIST` (技術・人文知識・国際業務).

**Task content is not verified immigration guidance.** The app must show a disclaimer pointing users to the Immigration Services Agency and their employer's HR.

## Screens (apps/mobile/src/app/)
- `(auth)/sign-in.tsx` — Apple first and most prominent, then Google. No email/password.
- `onboarding/` — step 1 offers **"Just here for the language"**, which calls `POST /users/me/onboarding` and lands on the decks with no checklist. An explicit answer rather than a skip link: not everyone who installs this is moving, and making them invent a visa route to reach the decks loses them on the first screen. One screen, three horizontal panes (`components/onboarding/checklist-wizard.tsx`): purpose → visa route → move date. The answers live in `lib/onboarding.tsx` (provider on the onboarding layout) and are submitted **once**, on the last pane — a half-written checklist on the server is worse than none.
- `(tabs)/index.tsx` — dashboard: progress ring, up to 3 tasks due within 7 days (overdue included), streak card. Shares `lib/checklist.tsx` state with the checklist tab so an optimistic toggle updates both.
- `(tabs)/checklist.tsx` — full checklist grouped by category
- `(tabs)/learn.tsx` — active deck with progress, due count and, when caught up, when it comes back. **No streak card**: the profile's grid owns the streak, and two places showing it disagreed the moment one was stale. Dimmed premium decks below. Invalidates on focus (`useInvalidateOnFocus`), or finishing a session leaves a stale "Review 12 cards" button behind.
- `cards/index.tsx` → `cards/[courseId].tsx` — decks first, then that deck's cards. A flat list of every seen card is hundreds of rows the moment someone gets going: slow to render and impossible to scan. The detail list is a **FlatList**, not a ScrollView, for the same reason. Each expanded card shows what every answer would schedule FROM WHERE IT IS NOW (Easy on a six-day card is twenty-odd days, not six — the multiplier applies to the current interval), and deck-wide actions live behind an **ellipsis in the navigation bar** opening a **real UIMenu** via `@react-native-menu/menu`. Two hand-rolled versions came first — a Modal sheet with a scrim, then an anchored JS popover — and both read as "not quite an iOS menu", because that is exactly what they were. The native control costs a `pod install` + rebuild and is worth it. The icon is bare: no chip, no circle, and NOT the `ellipsis.circle` symbol, whose ring renders hairline-thin at that size. Shown only above ONE card, since "set all" over a single card is the per-card action with extra steps. Within that menu only the irreversible action confirms; re-rating just applies, because the toast reports the count and every card keeps its own undo. Not under the list — below 104 rows is somewhere nobody scrolls. Removing every seen card pops back to the deck list, since this screen exists only to show seen cards and an empty one after a deliberate wipe is a dead end.
- **Two different resets, and the difference is the point.** A deck's "remove all seen cards" clears scheduling and leaves the streak and the study grid alone — those record days the learner really did turn up, and deleting a deck's progress does not un-happen them. Settings → "Start learning over" (`DELETE /users/me/progress`) is the one that erases the streak, `last_studied_on` and every `user_study_days` row too, because there erasing the history IS the request. Without the second action the first one has to choose between lying about the past and leaving a profile that reads "0 cards learned · 12 day streak".
- **Bulk re-rate and bulk forget are maintenance, not study**: no daily allowance spent, no streak moved, no study day recorded. Marking a hundred cards at once is "I have forgotten this deck", and charging a free learner a week of allowance for it — or drawing a day on the grid they did not earn — would both be wrong.
  - Single-card re-rate IS a real review (it spends a daily slot); the bulk version is not. Editing a card's text is deliberately absent everywhere: cards are shared content, so an edit would either corrupt the deck for everyone or need a per-user override table.
- `review/[courseId].tsx` — the flashcard session. A **modal, not a tab**: one task the learner starts and finishes, and the tab bar would invite them to wander out half-done.
- `(tabs)/profile.tsx` — avatar initial, **study grid** (20 weeks, GitHub-style, streak as its caption because a grid needs a moment's reading and "12 days" does not), plan card (free shows the cap + Upgrade, premium shows the renewal date), two stat tiles (cards learned, checklist), account rows
- `paywall.tsx` — modal. The benefit list must never promise kana or N5 — those are free, and a list that offers what the reader already has discredits the rest of it. Prices come from `product.priceString`, never hardcoded: already localised, and already right when App Store Connect pricing changes. Annual preselected.
- `checklist-setup.tsx` — the checklist wizard again, as a modal, for someone who chose the study-only path and later needs the checklist. Shares `components/onboarding/checklist-wizard.tsx` with onboarding; a second copy of that flow would drift. Its own `OnboardingProvider`, so backing out halfway leaves no draft behind.
- The reminder is **skipped entirely** for anyone who already studied today or whose every card is scheduled ahead (`ReminderService.isWorthReminding`). "A few cards is all it takes to keep your streak" sent to someone with nothing to open is how a push channel gets muted, which costs more than the one notification gains.
- `reminder-time.tsx` — the daily reminder picker. Waking hours only (7–22), plus Off. A full 24-hour list buries the sensible choices, and nobody wants a 3am nudge.
- `settings.tsx` — manage subscription (deep-links to Apple's own screen; there is no in-app cancel), restore purchases, legal links, sign out, delete account.
  - Privacy and terms are **hosted pages**, not in-app screens — App Store Connect needs a public privacy URL to submit at all. `LEGAL_BASE_URL` must be live before submission or the links 404 into a rejection.

Design principle carried from a prior project: positive reinforcement only. No red X, no "wrong", no punitive streak loss. "Again" is a neutral scheduling signal.
- The rating buttons are **Again = neutral ink, Hard = amber, Good = green, Easy = teal**. Deliberately no red on "Again", per the palette rule in `global.css`.
- Every button shows its own interval ("Good / 6 days") rather than only a highlighted one — there is no hover state on touch, and seeing all four is what makes honest self-rating feel safe.
- **One step of undo** (`DELETE /reviews/{cardId}`, V15). Four buttons under one thumb and no "are you sure?" — the way to keep rating frictionless is to make a wrong tap reversible. `user_card_progress` carries a `previous_*` snapshot written on every review; a null `previous_last_reviewed_at` means that review was the card's FIRST, so undo deletes the row and the card goes back to unseen. The snapshot is cleared after use: one step only, never a walk backwards through state the row no longer has.
- Undo deliberately does NOT touch the day streak or the study-day count. The learner did study today, and a mis-tap is not a reason to take that away.

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
