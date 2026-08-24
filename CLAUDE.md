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
- `users.current_streak_days` / `longest_streak_days` / `last_studied_on` — the study-day streak.
  - Not derivable from `user_card_progress` (only the latest review per card is kept, so drilling the same 20 cards daily would look like one study day). Cheaper than a review-history table.
  - A gap of two or more days restarts at **1**, not 0 — the learner did study today and the card should say so.
- `Entitlement` (is_premium, revenuecat_customer_id, expires_at) — one per user

## Endpoints
Paths below are as declared on the controller. Every one is served under `/api` (see WebMvcConfig) — `/users/me` is really `GET /api/users/me`.

| Controller | Method | Path | Request | Response |
|---|---|---|---|---|
| UserController | GET | `/users/me` | — | `UserResponse` |
| UserController | DELETE | `/users/me` | — | 204 |
| UserController | GET | `/users/me/entitlement` | — | `EntitlementResponse` |
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
- Free cap is `ReviewService.FREE_DAILY_REVIEW_LIMIT = 20`, enforced server-side. Past it, `POST /reviews/{cardId}` returns **402**, which the client treats as the paywall trigger (`ApiError.requiresPremium`). A premium deck returns 402 for the same reason. Until `Entitlement` lands in step 6 every account is free, so those 402s are unconditional.
- `DueCardsResponse` returns counts, not just cards: empty `cards` with `reviewsRemainingToday > 0` means "nothing due", with `0` it means "allowance spent". Different copy, so the client needs to tell them apart.

## Entitlement sync (EntitlementService)
Webhook events INITIAL_PURCHASE / RENEWAL / UNCANCELLATION → `isPremium = true`.
CANCELLATION / EXPIRATION / BILLING_ISSUE → `isPremium = false`.
Premium is ALWAYS checked server-side from the DB, never from a client-supplied flag.
`RevenueCatEventRequest` needs `@JsonIgnoreProperties(ignoreUnknown = true)`.

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
- `(tabs)/profile.tsx` — stats, plan status, settings
- `paywall.tsx`

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
