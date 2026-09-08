# App Store screenshot guide

Eight slides, in this order. App Store Connect accepts ten; eight is enough and every extra one is another thing to redo when the UI changes.

**Only the first three are seen by most people** — one shows in search results, three on the product page before anyone scrolls. Slides 1–3 have to carry the whole pitch on their own.

## Which backgrounds to use

Four, not eight. A gallery that changes background every slide reads as eight separate ads; repeating four reads as one product.

| Use | File | Why |
|---|---|---|
| **Primary** — slides 1, 2, 3 | `02-paper-teal-arc` | Teal band across the top holds the headline at full contrast, paper below holds the device. The only one built for a headline. |
| **Secondary** — slides 4, 6 | `01-paper-teal-amber` | Soft, quiet, keeps the screenshot the loudest thing on the slide. |
| **Warm** — slides 5, 8 | `04-paper-amber` | Amber is the app's Pro/accent colour. Marks the paid slides without saying "paid". |
| **Dark** — slide 7 | `05-ink-dark` | One dark slide breaks up a gallery of eight light ones. Shows dark mode exists. |

Skip `03-teal-deep` unless a slide is nothing but a headline — a full-bleed teal makes the phone screenshot on top of it look like a hole. `06-ink-teal-arc` is the dark twin of 02, only useful if you go dark-first. `07-paper-positive` and `08-paper-plain` are too close to `01` to earn a place; keep them as spares.

Headline text on light backgrounds: `#1c1b17`. On the teal band: `#ffffff`. Sub-caption: `#6b675c`. Never red — the app has none.

## Before you capture anything

```bash
xcrun simctl status_bar 6A4A38FE-2C38-4E24-9410-0395FA2E9DAB override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
```

Without it every slide shows a real clock and a half-drained battery. It resets when the simulator reboots, so re-run it then.

Shake the simulator (`Device ▸ Shake`) and dismiss the Expo dev menu if it is showing. Check the corner for the dev-client bubble before every shot.

```bash
xcrun simctl io 6A4A38FE-2C38-4E24-9410-0395FA2E9DAB screenshot screenshots/raw/<name>.png
```

Captures land at **1206×2622** on this device. Same 19.5:9 aspect as the 1290×2796 the store wants, so scaling up in the design tool is lossless-looking at gallery size. Only move to an iPhone 16/17 Pro Max simulator if you want the native pixels.

---

## The eight slides

### 1 — Checklist
**Screen:** Checklist tab, scrolled to the top so a category header and 3–4 tasks are visible.
**State that matters:** at least two tasks ticked and one showing an overdue or near date. An untouched checklist looks like a to-do app nobody uses.
**Background:** `02-paper-teal-arc`
**Headline:** Every step, dated to your move.
**Caption:** Visa, housing, banking, ward office.

This is the differentiator and it goes first. Every other Japanese app has flashcards; none of them has this.

### 2 — Review card, answer revealed
**Screen:** Review session, card flipped, all four rating buttons visible with their intervals.
**State that matters:** the card must be **revealed**, not face-down, and the four intervals must read clearly (Again 1d / Hard … / Good … / Easy …). That row is the single most convincing thing in the app.
**Background:** `02-paper-teal-arc`
**Headline:** Every answer tells you when it returns.
**Caption:** Spaced repetition, no guesswork.

Use a vocabulary card with a recognisable word, not a kana card — kana alone reads as a children's app in a thumbnail.

### 3 — Kana chart
**Screen:** Learn tab → Kana chart, scrolled to the top so the Hiragana/Katakana control and the whole gojūon table are in frame.
**State that matters:** nothing — the chart is bundled, so it looks identical on every device and needs no account. That is the point: a wall of Japanese characters reads as "this teaches Japanese" from across a thumbnail, faster than any list of deck names.
**Background:** `02-paper-teal-arc`
**Headline:** Both kana. Tap any one to hear it.
**Caption:** Free, and it costs no daily reviews.

Optionally shoot the sheet (tap a character) as an alternate — one huge し fills a thumbnail better than a grid, at the cost of showing less.

### 3b — Deck list *(optional, if you want nine slides)*
**Screen:** Learn tab, with N5 showing progress above at least one dimmed premium deck.
**State that matters:** the locked decks in frame. Showing what is locked is what makes the paywall read as an unlock later.
**Background:** `01-paper-teal-amber`
**Headline:** JLPT N5 to N3, and the ward office.

### 4 — Study grid and streak
**Screen:** Profile tab, framed on the 20-week grid with the streak caption under it.
**State that matters:** **the grid needs filled squares.** An empty grid is worse than no slide. If your account is new, this is the one slide worth studying a few days of cards for — or skip it and drop to seven slides.
**Background:** `01-paper-teal-amber`
**Headline:** A streak that survives a quiet day.
**Caption:** Nothing due doesn't break it.

### 5 — Ward Office deck
**Screen:** The Ward Office deck's card list, or a Ward Office card mid-review.
**State that matters:** words that are obviously officialdom — 住民登録, 在留カード, 国民健康保険. This is the slide that says "this app knows what you're about to walk into".
**Background:** `04-paper-amber`
**Headline:** The words the counter will use.
**Caption:** 55 cards for registering your life.

### 6 — Card browser, one card expanded
**Screen:** Cards ▸ a deck, one card expanded showing the four correction buttons and their intervals.
**State that matters:** expanded, so the intervals show. Collapsed it is just a list.
**Background:** `01-paper-teal-amber`
**Headline:** Fix a mis-tap. No penalty.
**Caption:** Change an answer without spending a review.

### 7 — Reminder time — dark mode
**Screen:** Reminder time picker, with an hour selected.
**How:** switch the simulator to dark first — `Features ▸ Toggle Appearance`, or iOS Settings ▸ Developer ▸ Dark Appearance. Reload the app so it re-reads the appearance.
**Background:** `05-ink-dark`
**Headline:** One nudge, in your timezone.
**Caption:** Skipped on days you've already studied.

Remember to switch back to light before capturing anything else.

### 8 — Pro
**Screen:** The paywall, with both prices visible and the trial line.
**State that matters:** prices must render — they come from StoreKit, so if they show as blank the simulator has no products loaded and the slide is unusable. Annual should be the preselected one.
**Background:** `04-paper-amber`
**Headline:** N4, N3, Ward Office. No daily limit.
**Caption:** 7-day free trial.

---

## Composing

- Device screenshot sits in the lower ~65% of the frame, headline in the top third. On slide 1–3 the headline sits inside the teal band.
- Keep the device at the same size and vertical position on every slide. Drifting scale between slides is the thing that makes a gallery look homemade.
- Headline: **88 px** at 1290 wide, bold, line-height ~1.1, 2 lines maximum, 6 words or fewer. If it needs three lines the headline is wrong, not the size.
- Caption: **46 px**, regular, one line, and optional — the headline has to work without it.
- Side margins 96–120 px. Headline in the top ~22% of the frame, above the device: that band is what gets scanned in search results before anyone swipes.
- The sizes are set by the thumbnail, not the full view. A portrait screenshot renders ~150–200 px wide in App Store search — a ~7× reduction, so 88 px arrives as about 12 px. At 72 px it arrives as 9 px, where words stop being words.
- Read every slide at **12.5% zoom** (~160 px wide) before you ship it. If the headline is not legible at a glance there, it fails where it matters most — however good it looks at 100%.
- No device bezel is required and Apple no longer wants one baked into the 1290×2796 asset. A subtle rounded corner + soft shadow on the raw capture is enough.

## Filing

- `raw/` — untouched captures, one per slide, named after the screen.
- `aso/` — the composed 1290×2796 exports, named `01`–`08` so the upload order is the file order.
- `aso/backgrounds/` — the generated backgrounds. Re-run `node screenshots/generate-backgrounds.mjs` after any palette change.
