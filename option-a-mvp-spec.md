# Ittekimasu — MVP Spec

## App Name — LOCKED
**Ittekimasu** — said when leaving home, expecting to return. Evocative of the relocation journey specifically.
- **Domain:** ittekimasu.app
- **Bundle ID / package (mobile):** `com.arnoldfederis.ittekimasu`
- **Backend package root:** `app.ittekimasu.server` (unchanged — deliberately tied to the developer, not the app name)

**Alternates, if the name ever needs to change:** Hajimeru ("to begin" — no collision found); Dekiru ("can-do" — usable but diffusely used across Japanese-learning products).
**Ruled out:** Ganbaru — ganbaru.app is an existing JLPT-prep product with active social handles (@ganbaruapp). Tabiji — too close to the existing TabiTalk app in the same space.

**Still to do:** claim the matching social handles (@ittekimasu or similar on X, Instagram, Threads) before starting #BuildInPublic posting — that category depends on a consistent public presence, and handles are first-come.

## Core Concept
A relocation-prep companion that launches Japan-only, built on a generalized spaced-repetition course engine so it can expand to any topic later. JLPT is the flagship course; the visa/document checklist is the other core pillar.

## Category Fit
- **#BuildInPublic** — authentic, since you're living the JLPT journey yourself. Highest prize pool of the realistic targets: 1st $30k / 2nd $20k / 3rd $10k, and 1st place is one of only two prizes with *paid* travel to NYC
- **Peace Prize** — genuine relocation/immigration support story. 1st $15k / 2nd $10k / 3rd $5k (1st place gets an invitation to the NYC conference, travel not covered)
- **HAMM** — clean, well-designed RevenueCat paywall. Same prize structure as Peace Prize
- **Keep Them Coming Back Award (OneSignal)** — the app already plans streak/task push notifications; building those on OneSignal instead of Firebase costs nothing extra and adds a fourth realistic category (one deployed campaign is enough to qualify)
- **Grand Prize (stretch)** — real precedent: Gurwi (AI-generated interactive lessons on any topic) was a 2025 runner-up with 13k+ users. Note: RevenueCat shortlists Grand Prize candidates by actual revenue generated during the submission period first, then judges the shortlist — so this one needs real paying users, not just a good idea

## MVP Feature Set (Japan-only launch)
1. **Onboarding** — pick visa type (Working Visa, Working Holiday for v1), get a pre-built checklist
2. **Checklist** — categorized tasks (visa/immigration, housing, banking, work, language), progress ring, due-date reminders
3. **JLPT daily practice** — N5 vocab/grammar deck, SM-2 spaced repetition, streak counter with a soft (non-punitive) reset on a missed day
4. **Freemium via RevenueCat** — free tier: 1 visa template + capped daily cards; premium: full N5–N3 path, more visa templates, unlimited reviews
5. **Push notifications** — streak/task reminders via OneSignal (also makes the app eligible for the Keep Them Coming Back Award)

**Stretch (v1.1, only if time allows):** OCR document scanner (reusing SnapFound's on-device OCR) to scan a Japanese form/notice and auto-extract key fields; "create your own course" for any topic beyond JLPT.

## Monetization — RevenueCat
- **Products:** Monthly (~$4.99) and Annual (~$29.99, positioned as ~50% savings)
- **Entitlement:** single `premium` entitlement gates: full JLPT deck, unlimited daily reviews, extra visa templates, OCR scan, custom courses
- **Free trial:** 7-day trial on the paywall — satisfies Devpost's requirement that judges be able to test premium features
- **Paywall trigger points:** hitting the free daily card cap, tapping a locked visa template, attempting an OCR scan
- **Backend enforcement:** Spring Boot listens to RevenueCat webhooks (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`) and updates the `Entitlement` table server-side, so premium content is gated in the API itself, not just hidden in the UI

## Tech Stack
- **Monorepo:** Turborepo — backend in `apps/server`, mobile app in `apps/mobile`
- **Backend:** Java 25 (LTS), Spring Boot 4.1.x, Maven, PostgreSQL, Spring Data JPA/Hibernate, package root `app.ittekimasu.server`
- **Auth:** Firebase Auth issues the JWT (handles sign-up, password storage, social login); Spring Security's filter chain verifies it server-side via a `FirebaseTokenFilter` using the Firebase Admin SDK
- **Frontend:** Expo (React Native)
- **Payments:** RevenueCat SDK
- **Push notifications:** OneSignal
- **Animation:** Rive (streak celebration, onboarding — Week 5 polish item)
- **Schema management:** Flyway migrations, `ddl-auto: validate` (Hibernate never auto-generates schema), JPA Buddy (IntelliJ plugin) to generate migrations from entity diffs

## Folder Structure
```
ittekimasu/                          (Turborepo root)
├── apps/
│   ├── server/                      (Spring Boot backend)
│   │   ├── src/main/java/com/arnoldfederis/server/
│   │   │   ├── ServerApplication.java
│   │   │   ├── config/
│   │   │   │   ├── SecurityConfig.java
│   │   │   │   └── FirebaseConfig.java
│   │   │   ├── controller/
│   │   │   │   ├── UserController.java
│   │   │   │   ├── ChecklistController.java
│   │   │   │   ├── CourseController.java
│   │   │   │   ├── ReviewController.java
│   │   │   │   └── RevenueCatWebhookController.java
│   │   │   ├── service/
│   │   │   │   ├── ChecklistService.java
│   │   │   │   ├── SpacedRepetitionService.java
│   │   │   │   ├── EntitlementService.java
│   │   │   │   └── UserService.java
│   │   │   ├── repository/
│   │   │   │   ├── UserRepository.java
│   │   │   │   ├── CourseRepository.java
│   │   │   │   ├── CardRepository.java
│   │   │   │   ├── UserCardProgressRepository.java
│   │   │   │   ├── ChecklistTemplateRepository.java
│   │   │   │   ├── ChecklistTaskRepository.java
│   │   │   │   ├── UserChecklistTaskRepository.java
│   │   │   │   └── EntitlementRepository.java
│   │   │   ├── entity/              (one class per ERD table)
│   │   │   ├── dto/
│   │   │   │   ├── request/
│   │   │   │   ├── response/
│   │   │   │   └── ReviewRating.java  (enum: AGAIN, HARD, GOOD, EASY)
│   │   │   ├── exception/
│   │   │   │   ├── GlobalExceptionHandler.java
│   │   │   │   └── ResourceNotFoundException.java
│   │   │   └── security/
│   │   │       └── FirebaseTokenFilter.java
│   │   ├── src/main/resources/
│   │   │   ├── application.yml
│   │   │   └── db/migration/        (Flyway SQL, V1__..., V2__..., generated via JPA Buddy)
│   │   ├── pom.xml
│   │   └── package.json             (thin wrapper so Turborepo can orchestrate `mvn` commands)
│   │
│   └── mobile/                      (Expo app)
│       ├── app/                     (Expo Router — file-based routes)
│       │   ├── (tabs)/
│       │   │   ├── index.tsx        (home dashboard)
│       │   │   ├── checklist.tsx
│       │   │   ├── learn.tsx        (flashcard review)
│       │   │   └── profile.tsx
│       │   └── onboarding/
│       ├── components/
│       ├── lib/                     (RevenueCat, Firebase Auth, OneSignal client setup)
│       ├── assets/
│       │   └── rive/                (.riv animation files)
│       ├── app.json
│       └── package.json
│
├── turbo.json
└── package.json                     (workspace root)
```
Build order below follows this structure — each numbered step touches the `entity`/`repository`/`service`/`controller` layers in `apps/server` plus the matching screen in `apps/mobile`.

## Data Model
See `erd.mermaid` — course engine (`COURSE`/`CARD`/`USER_CARD_PROGRESS`), checklist (`CHECKLIST_TEMPLATE`/`CHECKLIST_TASK`/`USER_CHECKLIST_TASK`), and `ENTITLEMENT` synced from RevenueCat.

## User Flow
See `user-flow.mermaid` — onboarding → dashboard → checklist/learning loops → paywall triggers → RevenueCat purchase → webhook → entitlement unlock.

## Checklist Content (what actually seeds the templates)
A **template** is a pre-built checklist tied to one visa type — pick "Working Visa" at onboarding, get that template's ~20 tasks copied into your own trackable list. A **category** is how tasks group within a template, so the checklist tab has sections instead of one flat wall of 20 items.

**Templates for v1** (two only — keep the content-writing scope small):
- `WORKING_VISA` — employer-sponsored engineer moving to Japan
- `WORKING_HOLIDAY` — working holiday visa route

**Categories** (shared across templates):
| Category | Example tasks |
|---|---|
| `VISA_IMMIGRATION` | Get Certificate of Eligibility (COE) from employer, submit visa application at embassy, prepare passport photos |
| `HOUSING` | Book temporary accommodation, find a guarantor company, register address at ward office within 14 days of arrival |
| `BANKING_MONEY` | Open a Japan Post bank account, set up international transfers, get a credit/IC card (Suica/Pasmo) |
| `WORK_ADMIN` | Get My Number card, enroll in health insurance, enroll in pension |
| `LANGUAGE` | Reach JLPT N5 vocab milestone, practice self-introduction, learn ward-office vocabulary |
| `LOGISTICS` | Book flights, ship or sell belongings, cancel home-country subscriptions/utilities |

`ChecklistTask.defaultDueOffsetDays` is relative to the user's target move date — so a task with `-60` becomes due 60 days before the move, and `+14` becomes due 14 days after arrival (like the ward-office registration deadline). That's what generates real due dates without asking the user to set 20 of them by hand.

**Note:** you'll need to verify the actual task content yourself before launch — this is a plausible starting outline based on the general shape of the process, not verified immigration guidance. Getting a detail wrong here matters more than in most apps, since people may act on it. Worth adding a disclaimer in-app pointing users to official sources (Japan's Immigration Services Agency, their employer's HR) for anything legally binding.

## Build Order
Each step is a full vertical slice — the entity, its controller and endpoints, and its screen — not backend-only. Building this way means you always have something tappable to check after each step, instead of a pile of backend code with nothing to show until the very end.

### 1. User
**Controller:** `UserController`

| Method | Path | Params | Request DTO | Response DTO |
|---|---|---|---|---|
| GET | `/users/me` | — | — | `UserResponse` |

**Files to create:**
```
entity/User.java
repository/UserRepository.java
service/UserService.java
controller/UserController.java
dto/response/UserResponse.java
security/FirebaseTokenFilter.java
config/SecurityConfig.java
config/FirebaseConfig.java
resources/db/migration/V1__create_users_table.sql
```
**DTO fields:**
```java
record UserResponse(UUID id, String email, String displayName, Instant createdAt) {}
```
**UI:** none custom — Firebase Auth's SDK handles sign-up/login.
Build this first to prove the pipeline works end to end: Expo → Spring Boot → Postgres → back.

### 2. Checklist templates
**Controller:** `ChecklistController`

| Method | Path | Params | Request DTO | Response DTO |
|---|---|---|---|---|
| GET | `/templates` | — | — | `List<ChecklistTemplateSummaryResponse>` |
| GET | `/templates/{visaType}` | path: `visaType` (String) | — | `ChecklistTemplateDetailResponse` |

**Files to create:**
```
entity/ChecklistTemplate.java
entity/ChecklistTask.java
repository/ChecklistTemplateRepository.java
repository/ChecklistTaskRepository.java
service/ChecklistService.java
controller/ChecklistController.java
dto/response/ChecklistTemplateSummaryResponse.java
dto/response/ChecklistTemplateDetailResponse.java
dto/response/ChecklistTaskResponse.java
resources/db/migration/V2__create_checklist_template_tables.sql
resources/db/migration/V3__seed_checklist_templates.sql
```
**DTO fields:**
```java
record ChecklistTemplateSummaryResponse(UUID id, String visaType, String country) {}

record ChecklistTemplateDetailResponse(UUID id, String visaType, String country,
                                       List<ChecklistTaskResponse> tasks) {}

record ChecklistTaskResponse(UUID id, String category, String title,
                             int defaultDueOffsetDays) {}
```
**UI:** `app/onboarding/visa-type.tsx` — visa-type picker screen.

### 3. Checklist tracking
**Controller:** `ChecklistController` (extends the one from step 2)

| Method | Path | Params | Request DTO | Response DTO |
|---|---|---|---|---|
| POST | `/users/me/checklist` | — | `CreateChecklistRequest` | `UserChecklistResponse` |
| GET | `/users/me/checklist` | query: `category` (String, optional) | — | `UserChecklistResponse` |
| PATCH | `/checklist-tasks/{taskId}` | path: `taskId` (UUID) | `UpdateChecklistTaskRequest` | `UserChecklistTaskResponse` |

**Files to create:**
```
entity/UserChecklistTask.java
repository/UserChecklistTaskRepository.java
dto/request/CreateChecklistRequest.java
dto/request/UpdateChecklistTaskRequest.java
dto/response/UserChecklistResponse.java
dto/response/UserChecklistTaskResponse.java
exception/ResourceNotFoundException.java
exception/GlobalExceptionHandler.java
resources/db/migration/V4__create_user_checklist_tasks_table.sql
```
(also extend `ChecklistService.java` and `ChecklistController.java` from step 2)

**DTO fields:**
```java
record CreateChecklistRequest(UUID templateId, LocalDate targetMoveDate) {}

record UpdateChecklistTaskRequest(boolean completed) {}

record UserChecklistResponse(Map<String, List<UserChecklistTaskResponse>> tasksByCategory,
                             int completedCount, int totalCount) {}

record UserChecklistTaskResponse(UUID id, String title, String category,
                                 boolean completed, LocalDate dueDate) {}
```
`targetMoveDate` is what `defaultDueOffsetDays` gets applied against to generate each task's real `dueDate`.

**UI:** `app/(tabs)/index.tsx` (dashboard checklist card), `app/(tabs)/checklist.tsx` (full checklist tab)

### 4. Course content
**Controller:** `CourseController`

| Method | Path | Params | Request DTO | Response DTO |
|---|---|---|---|---|
| GET | `/courses` | query: `topic` (String, optional) | — | `List<CourseSummaryResponse>` |

**Files to create:**
```
entity/Course.java
entity/Card.java
repository/CourseRepository.java
repository/CardRepository.java
controller/CourseController.java
dto/response/CourseSummaryResponse.java
resources/db/migration/V5__create_course_tables.sql
resources/db/migration/V6__seed_jlpt_n5_deck.sql
```
**DTO fields:**
```java
record CourseSummaryResponse(UUID id, String title, String topic,
                             String level, boolean isPremium) {}
```
**UI:** none yet — this step is just seeding the N5 deck so step 5 has data to review against.

### 5. Review engine
**Controllers:** `CourseController` (fetch due cards), `ReviewController` (submit a review)

| Method | Path | Params | Request DTO | Response DTO |
|---|---|---|---|---|
| GET | `/courses/{courseId}/due` | path: `courseId` (UUID) | — | `List<CardDueResponse>` |
| POST | `/reviews/{cardId}` | path: `cardId` (UUID) | `SubmitReviewRequest` | `ReviewResultResponse` |

**Files to create:**
```
entity/UserCardProgress.java
repository/UserCardProgressRepository.java
service/SpacedRepetitionService.java
controller/ReviewController.java
dto/ReviewRating.java
dto/request/SubmitReviewRequest.java
dto/response/CardDueResponse.java
dto/response/ReviewResultResponse.java
resources/db/migration/V7__create_user_card_progress_table.sql
```
**DTO fields:**
```java
enum ReviewRating { AGAIN, HARD, GOOD, EASY }

record SubmitReviewRequest(ReviewRating rating) {}

record CardDueResponse(UUID cardId, String frontText, String backText, String cardType) {}

record ReviewResultResponse(UUID cardId, LocalDate nextReviewDate,
                            int intervalDays, int streakCount) {}
```
**UI:** `app/(tabs)/learn.tsx` — flashcard review screen, streak display. This is where the SM-2 logic actually runs (see Core Logic below).

### 6. Entitlements
**Controllers:** `UserController` (check status), `RevenueCatWebhookController` (sync from RevenueCat)

| Method | Path | Params | Request DTO | Response DTO |
|---|---|---|---|---|
| GET | `/users/me/entitlement` | — | — | `EntitlementResponse` |
| POST | `/webhooks/revenuecat` | header: RevenueCat signature (not a JWT) | `RevenueCatEventRequest` | — (200 OK) |

**Files to create:**
```
entity/Entitlement.java
repository/EntitlementRepository.java
service/EntitlementService.java
controller/RevenueCatWebhookController.java
dto/request/RevenueCatEventRequest.java
dto/response/EntitlementResponse.java
resources/db/migration/V8__create_entitlements_table.sql
```
**DTO fields:**
```java
record RevenueCatEventRequest(String eventType, String appUserId, Long expirationAtMs) {}

record EntitlementResponse(boolean isPremium, Instant expiresAt) {}
```
`RevenueCatEventRequest` mirrors only the subset of RevenueCat's webhook payload the app actually needs — annotate the class with `@JsonIgnoreProperties(ignoreUnknown = true)` so the rest of their payload doesn't break deserialization.

**UI:** `app/paywall.tsx`, `lib/revenuecat.ts` — paywall screen + RevenueCat SDK purchase flow.

### 7. Push notifications
No new entity, controller, or DTO — OneSignal's client SDK registers the device directly; no custom backend endpoint needed.
**UI:** `lib/onesignal.ts` + permission prompt, streak/task reminder copy.

### 8. Polish
No new entity, controller, or DTO.
**UI:** `assets/rive/*.riv` + Rive animations (streak celebration, onboarding), general UI refinement pass.

---
Why this order: every table with a `user_id` foreign key needs `User` to exist first (step 1). Steps 2–3 and 4–5 are each a "static data, then the thing that tracks against it" pair. `Entitlement` is last because it depends on RevenueCat being wired up, which is Week 4 territory anyway. This lines up with the Week 1–5 plan further down.

The table below is the same endpoint set again, just as one flat reference instead of split by build step — useful once you're no longer building sequentially and just need to look something up.

## API Endpoints (finalized)
All endpoints except the webhook require a valid Firebase JWT (verified by `FirebaseTokenFilter`), which resolves to the current user server-side — routes use `/me` rather than a path-supplied user ID, never trusted from the URL. On a user's first authenticated request, `UserService` transparently creates their `User` row if one doesn't exist yet — there's no separate "register" endpoint, since Firebase already handled signup.

| Controller | Method | Path | Params | Request DTO | Response DTO |
|---|---|---|---|---|---|
| `UserController` | GET | `/users/me` | — | — | `UserResponse` |
| `UserController` | GET | `/users/me/entitlement` | — | — | `EntitlementResponse` |
| `ChecklistController` | GET | `/templates` | — | — | `List<ChecklistTemplateSummaryResponse>` |
| `ChecklistController` | GET | `/templates/{visaType}` | path: `visaType` (String) | — | `ChecklistTemplateDetailResponse` |
| `ChecklistController` | POST | `/users/me/checklist` | — | `CreateChecklistRequest` | `UserChecklistResponse` |
| `ChecklistController` | GET | `/users/me/checklist` | query: `category` (String, optional) | — | `UserChecklistResponse` |
| `ChecklistController` | PATCH | `/checklist-tasks/{taskId}` | path: `taskId` (UUID) | `UpdateChecklistTaskRequest` | `UserChecklistTaskResponse` |
| `CourseController` | GET | `/courses` | query: `topic` (String, optional) | — | `List<CourseSummaryResponse>` |
| `CourseController` | GET | `/courses/{courseId}/due` | path: `courseId` (UUID) | — | `List<CardDueResponse>` |
| `ReviewController` | POST | `/reviews/{cardId}` | path: `cardId` (UUID) | `SubmitReviewRequest` | `ReviewResultResponse` |
| `RevenueCatWebhookController` | POST | `/webhooks/revenuecat` | header: RevenueCat signature (not a JWT) | `RevenueCatEventRequest` | — (200 OK) |

## DTOs
**Requests** (`dto/request/`)
| DTO | Fields |
|---|---|
| `CreateChecklistRequest` | `templateId: UUID` |
| `UpdateChecklistTaskRequest` | `completed: boolean` |
| `SubmitReviewRequest` | `rating: ReviewRating` |
| `RevenueCatEventRequest` | `eventType: String`, `appUserId: String`, `expirationAtMs: Long` (mirrors the subset of RevenueCat's webhook payload the app actually needs) |

**Responses** (`dto/response/`)
| DTO | Fields |
|---|---|
| `UserResponse` | `id: UUID`, `email: String`, `displayName: String`, `createdAt: Instant` |
| `EntitlementResponse` | `isPremium: boolean`, `expiresAt: Instant` |
| `ChecklistTemplateSummaryResponse` | `id: UUID`, `visaType: String`, `country: String` |
| `ChecklistTemplateDetailResponse` | `id: UUID`, `visaType: String`, `country: String`, `tasks: List<ChecklistTaskResponse>` |
| `ChecklistTaskResponse` | `id: UUID`, `category: String`, `title: String`, `defaultDueOffsetDays: int` |
| `UserChecklistResponse` | `tasksByCategory: Map<String, List<UserChecklistTaskResponse>>`, `completedCount: int`, `totalCount: int` |
| `UserChecklistTaskResponse` | `id: UUID`, `title: String`, `category: String`, `completed: boolean`, `dueDate: LocalDate` |
| `CourseSummaryResponse` | `id: UUID`, `title: String`, `topic: String`, `level: String`, `isPremium: boolean` |
| `CardDueResponse` | `cardId: UUID`, `frontText: String`, `backText: String`, `cardType: String` |
| `ReviewResultResponse` | `cardId: UUID`, `nextReviewDate: LocalDate`, `intervalDays: int`, `streakCount: int` |

**Enum** (`dto/ReviewRating.java`): `AGAIN`, `HARD`, `GOOD`, `EASY` — shared between the request DTO and `SpacedRepetitionService`.

Naming convention used throughout: `*Request` for anything deserialized from a request body, `*Response` for anything serialized back out, `*Summary*` for list-view DTOs with fewer fields than the matching `*Detail*`/full DTO. Controllers never accept or return entities directly — every boundary crossing goes through a DTO, which keeps your JPA relationships from leaking into the API contract (and avoids Hibernate lazy-loading exceptions when Jackson tries to serialize a proxy).

## Core Logic

**SM-2 spaced repetition** (`SpacedRepetitionService.processReview`):
```
function processReview(progress, rating):
    if rating == AGAIN:
        progress.intervalDays = 1
        progress.easeFactor = max(1.3, progress.easeFactor - 0.20)
        progress.streakCount = 0
    else:
        if rating == HARD:
            progress.easeFactor = max(1.3, progress.easeFactor - 0.15)
            multiplier = 1.2
        else if rating == GOOD:
            multiplier = progress.easeFactor
        else if rating == EASY:
            progress.easeFactor += 0.15
            multiplier = progress.easeFactor * 1.3

        progress.intervalDays = (progress.intervalDays == 1)
            ? 6
            : round(progress.intervalDays * multiplier)
        progress.streakCount += 1

    progress.nextReviewDate = today + progress.intervalDays days
    save(progress)
```
`easeFactor` starts at 2.5 for a new card, floors at 1.3 so a hard card never schedules absurdly fast. This is the one piece of real algorithmic logic in the backend — worth being able to walk through in an interview.

**RevenueCat webhook → entitlement sync** (`EntitlementService.handleWebhookEvent`):
```
function handleWebhookEvent(event):
    entitlement = findByUserId(event.appUserId)
    switch event.type:
        case INITIAL_PURCHASE, RENEWAL, UNCANCELLATION:
            entitlement.isPremium = true
            entitlement.expiresAt = event.expirationAtMs
        case CANCELLATION, EXPIRATION, BILLING_ISSUE:
            entitlement.isPremium = false
    entitlement.revenuecatCustomerId = event.appUserId
    save(entitlement)
```
This runs server-side on every webhook call, independent of the client — so premium status can't be spoofed by tampering with the mobile app, since every gated endpoint checks `Entitlement.isPremium` from the database, not a client-supplied flag.

## Devpost Submission Checklist (per official rules)
- [ ] App published to App Store or Play Store, first public release *during* Jul 31 – Sep 30
- [ ] Demo video, under 2 minutes, uploaded publicly to YouTube or Vimeo
- [ ] Text description of features and functionality
- [ ] 1024×1024 app icon
- [ ] At least one screenshot at 1179×2556, no device frame
- [ ] Free trial active on the paywall (already planned) or a promo code for judges
- [ ] Peace Prize entry: description of community/society impact
- [ ] HAMM entry: description of monetization strategy + any conversion/revenue numbers
- [ ] #BuildInPublic entry: links to public posts tagged #Shipaton, description of how sharing publicly improved the app
- [ ] OneSignal entry: OneSignal App ID + description of the campaign deployed
- [ ] Grand Prize entry (if pursuing): description of post-launch growth efforts + concrete numbers
- [ ] Register early and complete the participant form to unlock Ship Kit sponsor perks as milestones are hit (RevenueCat project created, first test purchase, first Store API call, first real purchase)

## Week-by-Week Plan (Jul 31 – Sep 30)
- **Wk 1:** repo + Expo scaffold + Spring Boot scaffold (Java 25, Spring Boot 4.1.x, Maven), Postgres, Firebase project, RevenueCat project, OneSignal project, data model
- **Wk 2:** checklist backend + UI
- **Wk 3:** JLPT backend (SM-2 service) + flashcard review UI
- **Wk 4:** RevenueCat paywall wiring, webhook handling, entitlement gating
- **Wk 5:** onboarding flow, push notifications, UI polish
- **Wk 6:** buffer / stretch feature (OCR scan) if on schedule
- **Wk 7:** bug fixes, Sentry crash monitoring, store listing prep
- **Wk 8:** submit to App Store/Play Store, start #BuildInPublic posts
- **Wk 9:** demo video, Devpost write-up, final submission
