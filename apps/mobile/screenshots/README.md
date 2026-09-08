# Screenshots

Two separate things, deliberately kept apart:

- **`raw/`** — untouched device captures. No frame, no headline, no background. These are the layer you drop onto something else.
- **`aso/backgrounds/`** — 1290×2796 PNG backgrounds in the app's palette, ready to compose a raw capture on top of.
- **`aso/`** — where the finished App Store screenshots go once composed.

Keeping raw captures separate is what makes re-framing cheap: a copy change or a new background never means re-running the simulator.

## Backgrounds

```bash
node screenshots/generate-backgrounds.mjs
```

No dependencies — Node's `zlib` plus a small PNG encoder in the script. Adding `sharp` would have pulled a native module into a React Native project for the sake of eight PNGs, and every `expo install` afterwards would be one more thing to check.

| File | Use it for |
|---|---|
| `01-paper-teal-amber` | The default. Paper canvas, teal above, amber below. |
| `02-paper-teal-arc` | Teal band across the top third for a headline, paper below for the device. |
| `03-teal-deep` | Full teal. White copy. The screenshot that has to shout — usually the first one. |
| `04-paper-amber` | Warm. The Pro / paywall screenshot. |
| `05-ink-dark` | Dark mode screenshots. |
| `06-ink-teal-arc` | Dark, with the headline band. |
| `07-paper-positive` | Green and calm. The streak and study-grid screenshot. |
| `08-paper-plain` | Nearly flat. For a screenshot that carries itself. |

Every colour is a literal copy of a token in `src/global.css`. Nothing resolves CSS variables in a PNG, so a palette change has to be repeated in `generate-backgrounds.mjs`.

## Capturing

Captures come from a booted simulator with the dev build installed and Metro running.

```bash
xcrun simctl status_bar <udid> override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
```

Set that **before** capturing, or every screenshot shows a real clock and a half-empty battery. Apple's own marketing convention is 9:41.

```bash
xcrun simctl io <udid> screenshot raw/01-checklist.png
```

### Device size

App Store Connect wants **1290×2796** (iPhone 6.9"). That is the native resolution of the **Pro Max** simulators — an iPhone 17 Pro captures 1206×2622, which is the right aspect ratio but has to be scaled up. Capture on a Pro Max if the raw pixels matter; scale if you are compositing onto a background anyway, which is the usual case here.

## Shots worth having

In rough order of how well they sell the app:

1. Learn tab — a deck with cards due, the day's progress
2. Review screen — a card revealed, all four intervals visible
3. Checklist — grouped by category, some tasks done, dates showing
4. Profile — the study grid and the streak
5. Kana chart — the gojūon table, or one character in its sheet
6. Deck list — N5 free, N4/N3/Ward Office dimmed behind the lock
6. Card browser — one card expanded, showing what each answer would schedule
7. Paywall
8. Onboarding — the visa route step

Numbers 1 and 2 are the product. If only two screenshots get read, those are them.
