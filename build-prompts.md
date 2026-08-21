# Ittekimasu — Build Prompts

Use these in Claude Code, one step per session, in order. `CLAUDE.md` is read automatically, so you don't need to re-explain the stack each time.

Every step has a **Backend** prompt and a **Mobile** prompt. Run them as two separate sessions — backend first, verify the endpoint responds, then build the screen against it. Don't stack unverified steps.

---

## Compressed timeline (Aug 20 → Sep 30)

Store submission is the real deadline, not Sep 30 — App Store review takes days and a rejection costs a week. **Target: submit to stores by Sep 12.**

| Week | Dates | Goal |
|---|---|---|
| 1 | Aug 20–26 | Steps 0–2: scaffold both apps, auth + login screen, templates + onboarding |
| 2 | Aug 27–Sep 2 | Steps 3–4: checklist tracking + dashboard/checklist tabs, course content + learn tab |
| 3 | Sep 3–9 | Step 5: SM-2 engine + flashcard review screen |
| 4 | Sep 10–16 | Step 6: RevenueCat + paywall + profile. **Submit to stores by Sep 12.** |
| 5 | Sep 17–23 | OneSignal, polish, fix store rejections |
| 6 | Sep 24–30 | Demo video, screenshots, Devpost writeup, submit |

### Cut from MVP to make this fit
OCR scanner · Rive animations · multiple visa templates (ship `ENGINEER_SPECIALIST` only) · N4/N3 decks (N5 only) · export data · reset progress

### Do not cut
Sign in with Apple · `DELETE /users/me` · restore purchases · free trial · content disclaimer

---

## Step 0 — Scaffold both apps

**Backend**
```
Set up the Spring Boot backend in apps/server per CLAUDE.md.

- Maven, Java 25, Spring Boot 4.1.x
- Dependencies: web, data-jpa, validation, postgresql, flyway-core, lombok, firebase-admin
- application.yml: datasource from env vars, ddl-auto validate, flyway enabled,
  show-sql true, open-in-view false
- Create the empty package structure: config, controller, service, repository,
  entity, dto/request, dto/response, exception, security

Don't write any entities yet. Confirm the app starts and connects to Postgres.
```

**Mobile**
```
Set up the Expo app in apps/mobile.

- Expo Router with file-based routing
- Tab layout with four tabs: index (home), checklist, learn, profile
- An (auth) route group and an onboarding/ route group outside the tabs
- Set up a design token file: colors (deep teal #0F6E56 primary, amber #EF9F27
  accent, warm off-white #F5F1E6), spacing scale, type scale
- Build shared components: Button, Card, ProgressRing, ListRow, ScreenHeader
- A typed API client in lib/api.ts that attaches the Firebase JWT as a Bearer header
- Placeholder screens for each tab so navigation works end to end

Bundle ID com.arnoldfederis.ittekimasu. No backend calls yet — just navigable shell.
```

---

## Step 1 — User + auth

**Backend**
```
Implement step 1 from CLAUDE.md: the User entity and Firebase auth.

- V1__create_users_table.sql: id UUID PK, firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL, display_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
- User entity: Lombok, @GeneratedValue(strategy = UUID), @CurrentTimestamp timestamps
- UserRepository with findByFirebaseUid
- FirebaseConfig: FirebaseAuth bean from a service account path in an env var
- FirebaseTokenFilter: OncePerRequestFilter, reads Bearer token, verifyIdToken,
  sets the UID as the principal in SecurityContext, 401 on failure
- SecurityConfig: stateless, CSRF off, /webhooks/** permitAll, everything else
  authenticated, filter registered before UsernamePasswordAuthenticationFilter
- UserService.findOrCreate(firebaseUid) — auto-creates the row on first request
- UserController: GET /users/me and DELETE /users/me (cascade delete)
- GlobalExceptionHandler + ResourceNotFoundException + ErrorResponse record

Then write an integration test that hits GET /users/me with a mocked FirebaseToken.
```

**Mobile**
```
Build the sign-in screen and auth flow in apps/mobile.

- Firebase Auth setup in lib/firebase.ts
- (auth)/sign-in.tsx: app icon, name, tagline "Your move to Japan, one step at a time",
  then three stacked buttons — Sign in with Apple FIRST and most prominent (Apple
  requires this when other social login is offered), then Google, then email.
  Terms/privacy line at the bottom.
- Use AppleAuthentication.AppleAuthenticationButton with proper nonce hashing
- (auth)/email.tsx for the email/password path
- Auth state listener that routes: signed out → (auth), signed in but no checklist
  → onboarding, otherwise → (tabs)
- On first Apple sign-in, capture fullName immediately — Apple only returns it once
- Call GET /users/me after sign-in to trigger backend user creation

Requires a dev client build (npx expo prebuild) — this won't run in Expo Go.
```

---

## Step 2 — Checklist templates + onboarding

**Backend**
```
Implement step 2 from CLAUDE.md: checklist template reference data.

- V2: checklist_templates (visa_type, country, purpose) and checklist_tasks
  (template_id FK, category, title, default_due_offset_days, sort_order)
- V3: seed ONE template — ENGINEER_SPECIALIST, purpose WORK, country JP —
  with ~20 tasks across the six categories in CLAUDE.md.
  Realistic offsets: COE application around -90, embassy application -60,
  flights -30, ward office registration +14.
- Entities, repositories, ChecklistService, ChecklistController
- GET /templates and GET /templates/{visaType}
- DTOs per CLAUDE.md

Add a comment on the seed migration noting the task content needs verification
against official immigration sources before launch.
```

**Mobile**
```
Build the three-screen onboarding flow in apps/mobile/app/onboarding/.

1. purpose.tsx — "Why are you moving?" Four large tappable cards with icons:
   Work / Study / Family / Something else. Progress bar showing step 1 of 3.
2. visa.tsx — filtered by the chosen purpose, fetched from GET /templates.
   Each row shows the English name, the Japanese name (技術・人文知識・国際業務),
   and a short descriptor. Badge the most common option. Include a dashed
   "Not sure which one? Answer 3 questions instead" card at the bottom.
   Only ENGINEER_SPECIALIST is seeded for MVP — show the others as disabled
   "coming soon" rows rather than hiding them.
3. move-date.tsx — month/year picker, with helper text explaining that due dates
   are set relative to this.

Selected state uses a teal border with a tinted background. Persist choices in
local state across the flow, submit once at the end (step 3 endpoint).
```

---

## Step 3 — Checklist tracking + dashboard

**Backend**
```
Implement step 3 from CLAUDE.md: per-user checklist tracking.

- V4: user_checklist_tasks (user_id, task_id, completed, due_date),
  unique on (user_id, task_id)
- POST /users/me/checklist takes CreateChecklistRequest(templateId, targetMoveDate),
  copies every task from the template, computes due_date as
  targetMoveDate + defaultDueOffsetDays
- GET /users/me/checklist returns tasks grouped by category with completed/total counts
- PATCH /checklist-tasks/{taskId} toggles completion, 403 if the task isn't the caller's
```

**Mobile**
```
Build the dashboard and checklist tabs.

(tabs)/index.tsx — dashboard:
- "Good morning, [name]" header with a notification bell
- Progress card: circular ring showing completion percent, visa type,
  "13 of 20 done"
- "Due this week" section — up to three task rows with checkbox, title, and
  category/due hint
- Streak card at the bottom in warm amber: flame icon, "12 day streak",
  cards remaining today, and a Practice button that deep-links to the learn tab

(tabs)/checklist.tsx:
- Header with a filter icon, thin overall progress bar underneath
- Tasks grouped under uppercase category headers
- Completed tasks show a filled check and strikethrough in muted text
- Deadline-critical tasks (like ward office +14) show their hint in amber
- Optimistic toggle on tap, rolling back if the PATCH fails
- A dismissible disclaimer card: content is guidance only, verify with the
  Immigration Services Agency and your employer's HR

No red error states anywhere. Uncompleted is neutral gray, never a warning color.
```

---

## Step 4 — Course content + learn tab

**Backend**
```
Implement step 4 from CLAUDE.md.

- V5: courses and cards tables
- V6: seed the JLPT N5 course with 100 vocabulary cards
  (kanji/kana front, reading + English meaning back)
- Entities, repositories, CourseController, GET /courses
```

**Mobile**
```
Build (tabs)/learn.tsx — the course list screen.

- Streak card at the top in warm amber: flame, current streak, longest streak
- Active course card (JLPT N5): title, ACTIVE badge, progress bar,
  "210 of 500 cards · 12 due today", and a full-width primary
  "Review 12 cards" button
- Locked course cards (N4, ward-office vocabulary): dimmed to ~65% opacity,
  lock icon, "Premium" label. Visible but not hidden — seeing what exists is
  what makes the paywall feel like an unlock rather than a wall.
- Tapping a locked course opens the paywall (build in step 6; stub for now)
```

---

## Step 5 — SM-2 engine + flashcard review

**Backend**
```
Implement step 5 from CLAUDE.md: the spaced repetition engine.

- V7: user_card_progress (user_id, card_id, ease_factor, interval_days,
  next_review_date, streak_count), unique on (user_id, card_id)
- SpacedRepetitionService.processReview implementing the exact SM-2 rules in CLAUDE.md
- GET /courses/{courseId}/due — cards where next_review_date <= today,
  plus unseen cards, capped at the free daily limit of 20
- POST /reviews/{cardId} — takes SubmitReviewRequest(rating),
  returns ReviewResultResponse

Write unit tests for SpacedRepetitionService covering all four ratings, the
1→6 day first-interval jump, and the 1.3 ease floor.
```

**Mobile**
```
Build the flashcard review screen (a modal route, not a tab).

- Header: close X on the left, small flame + streak count on the right
- Segmented progress bar showing position in the session
- Card area: large kanji/kana front, tap to reveal reading, divider, English
  meaning, and an example sentence
- Four rating buttons in a row: Again / Hard / Good / Easy, outlined in
  red / amber / green / teal respectively
- Under the buttons, show the resulting interval for the highlighted choice
  ("Good → next review in 6 days") — making the algorithm visible encourages
  honest self-rating
- "Card 4 of 12 · JLPT N5" footer
- Session complete screen: cards reviewed, streak updated, encouraging copy

Critical: "Again" is a neutral scheduling signal, not a failure. No red X,
no "wrong", no shake animation, no negative sound.
```

---

## Step 6 — RevenueCat, paywall, profile

**Backend**
```
Implement step 6 from CLAUDE.md: entitlements.

- V8: entitlements table, one row per user
- RevenueCatWebhookController: POST /webhooks/revenuecat, verify the shared-secret
  Authorization header, map events to isPremium per CLAUDE.md
- EntitlementService.handleWebhookEvent
- GET /users/me/entitlement
- A reusable check so premium endpoints throw EntitlementRequiredException,
  mapped to HTTP 402 in GlobalExceptionHandler
- Enforce the 20/day free review cap server-side in the due-cards endpoint
```

**Mobile**
```
Build the paywall, profile tab, and settings.

paywall.tsx (modal):
- App icon, "Go further", "Everything you need for the move"
- Four benefit rows with green checks: full N5 to N3 path, unlimited daily
  reviews, extra decks, priority updates
- Two plan cards — Annual ($29.99/yr, "save 50%") preselected with teal border,
  Monthly ($4.99/mo) below
- Full-width "Start 7-day free trial" button
- Fine print: "Then $29.99/year. Cancel anytime."

(tabs)/profile.tsx:
- Avatar initial, display name, "Signed in with Apple" subtitle
- Plan status card — free plan shows the limit ("20 cards a day · N5 only")
  with an Upgrade button; premium shows renewal date
- Three stat tiles: day streak, cards learned, checklist percent
- Setting rows: visa type, move date, reminder time, account settings

settings.tsx:
- SUBSCRIPTION: manage subscription (deep-links to OS settings), restore purchases
- ABOUT: privacy policy, terms
- Sign out, and Delete account in red at the bottom with a confirmation dialog

Wire RevenueCat SDK init, purchase flow, and restorePurchases. Any 402 from the
API opens the paywall.
```

---

## Step 7 — OneSignal + ship

**Mobile**
```
- OneSignal SDK setup, permission prompt after the first completed review session
  (not on launch — asking before showing value tanks opt-in rates)
- Daily reminder campaign at the user's chosen time
- App icon at 1024×1024: teal squircle, white doorway arch, amber path dot
- Screenshots at 1179×2556, no device frame
- EAS build config for iOS and Android production
- Sentry crash reporting
- Privacy policy and terms pages live on ittekimasu.app
```
