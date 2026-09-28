# Demo video: one-take script, recorded on the production app

One continuous take on the **App Store version**, including a **real** trial purchase.

**Setup this is written for:** a QuickTime movie recording window showing your face, and a
macOS **iPhone Mirroring** window showing the app. You control the phone from the Mac with the
trackpad and keyboard. Nothing gets cut together afterwards, so the order of the script is the
order you click.

Shipaton caps the demo at **2 minutes**. As written, the voiceover is about **300 words**:
roughly 2:00 of talking at a normal pace, plus ~15 seconds where you're only clicking (Apple's
purchase sheet, the unlock, Control Center). **That's over the cap.** Time a full dry run with
a stopwatch, then use the trims in "Getting under 2:00" below until you finish by 1:55.

**Honesty rule for everything you say:** the origin is a technical exam for a job in Japan and
the research that followed. It is not a booked move. Don't say you're moving, don't imply a
date, and don't claim an outcome for the exam.

---

## What iPhone Mirroring can't do, and how the script avoids it

| Limitation | So the script |
|---|---|
| Notification Center can't be opened | Shows the reminder inside the app (Profile → reminder) instead of a delivered notification |
| Control Center **works**, but Airplane Mode risks dropping the mirroring link | Goes offline with the **Wi-Fi and Cellular Data** toggles instead. The Wi-Fi toggle only disconnects from networks, so mirroring stays up. |
| Mirroring ends once the iPhone is unlocked | Never touches the phone. **Test the purchase confirmation in the dry run** (see below). |

---

## The one thing that can cost real money

The paywall's button says **"Start 7-day free trial"** no matter what: that label is hardcoded
in `paywall.tsx`, and nothing checks whether your Apple ID is still eligible for the trial.
If this Apple ID has used the Ittekimasu Pro trial before in production, the button still
says "free trial", but Apple **charges the full price immediately**.

**Apple's purchase sheet is the only thing that tells the truth.** Check it in the dry run.
If the sheet doesn't say the first week is free, **do not record the purchase.** Use Plan B at
the bottom of this file.

(TestFlight/sandbox purchases don't count against production eligibility, so your TestFlight
testing hasn't used up the real trial.)

---

## The flow in one line

Checklist → ward office task → Learn tab → click the **locked** Ward Office deck → paywall →
**real trial purchase** → deck unlocks → review 区役所 → undo → go offline and keep rating →
back online → reminder screen → close.

---

## Setup

**The app**
- Install the **App Store** version (it replaces the TestFlight build).
- Sign in with an app account that is **free and has never been premium in production**, and
  that has **already finished onboarding** (engineer route, sample move date **Oct 31**).
- Tick the **first four Visa & Immigration tasks** (the four COE steps). They're already past
  due, and ticked they read as realistic progress instead of four amber "days ago" labels.
  The section header should then read 4/8.
- Set a daily reminder beforehand (e.g. 8 PM), so the Profile row in beat 8 shows one.

**Mac and recording**
- Arrange the QuickTime face window and the iPhone Mirroring window side by side, then record
  the screen (QuickTime → File → New Screen Recording, or Screen Studio / OBS).
- **Audio:** in iPhone Mirroring, the card's spoken reading plays through the **Mac**. QuickTime
  screen recording only records the microphone, not the Mac's sound, so either keep the Mac's
  speakers up so your mic picks the reading up, or use a recorder that captures system audio
  (Screen Studio, OBS).
- Turn on a **Focus mode on both the Mac and the iPhone.** iPhone notifications appear on the
  Mac's screen during mirroring, and the whole screen is being recorded.
- Close every other window and hide anything personal on the desktop.

**Phone state**
- Dismiss the "readings are spoken aloud" hint on the review screen before recording. Leave the
  checklist's "Guidance only" disclaimer visible.
- Start the take with the app open on the **Checklist tab**, scrolled to the top.

**Dry run: do this until beats 1–5 feel easy**

The purchase can only happen once, but everything up to the moment you confirm it can be
practiced as many times as you like.

1. Run beats 1–4 out loud with the recording on, to check framing and audio.
2. At beat 5, click **Start 7-day free trial**.
3. Apple's sheet appears in the mirroring window. **Check three things** (below).
4. Click **Cancel** on the sheet. The app handles a cancelled sheet silently, so nothing is
   bought and no error shows.
5. Close the paywall and start over.

While the sheet is up, check:
- **It says the first week is free** (something like "1 week free, then …/year"). If it only
  shows a price, stop: this Apple ID isn't eligible. Use Plan B.
- **How it wants you to confirm.** If it asks for something you can do from the Mac (a
  password, or a button in the mirroring window), you're fine. If it needs Face ID or a
  double-click of the phone's side button, touching the phone may end the mirroring session.
  Find out now, not during the real take. If it does end the session, use Plan B.
- **What personal details it shows** (usually the Apple ID being charged). If you don't want
  that in a public video, use a different Apple ID.

**You**
- Learn the script in beats, not word for word. A teleprompter app works if you want one.
- The real take is the one you commit to at beat 5. Once you confirm the purchase, finish the
  take no matter what.

---

## The script

`[CAM]` = look at the camera. `[PHONE]` = look at the mirroring window and let the screen lead.

### Beat 1 · 0:00–0:14 · `[CAM]`
*Checklist showing in the mirroring window.*

> "Hi, I'm [your name]. A few months ago I took a technical exam for a job in Japan. When I
> looked into what actually moving there involves, I found two problems that nobody solves
> together."

### Beat 2 · 0:14–0:28 · `[PHONE]`
*Scroll the checklist slowly with the trackpad. Let the dates be readable.*

> "The first one is paperwork. You pick your visa and your move date, and every step gets a
> real date: the Certificate of Eligibility, the visa, your residence card at the airport."

### Beat 3 · 0:28–0:38 · `[PHONE]`
*Stop on the **last task in Visa & Immigration**: "Register your address at the ward office
within 14 days of moving in". Not the Work Admin one: this title states the 14-day rule itself,
so the screen explains why its label reads about seven weeks out.*

> "And this one comes two weeks after you land: register your address at the ward office.
> That's the second problem, because most of those forms, and most of those conversations,
> are in Japanese."

### Beat 4 · 0:38–0:56 · `[PHONE]`
*Click the Learn tab. Click the dimmed **Ward Office** deck. The paywall opens. Hold on the
bullets, then the small print.*

> "So there's a deck for exactly that. It's part of Pro, and the paywall tells you what you
> get, and what you don't. Reviews are uncapped, but new cards stay paced at ten a deck each
> day, because cramming doesn't stick."

### Beat 5 · 0:56–1:12 · `[PHONE]`
*Annual is preselected. Click **Start 7-day free trial**. Apple's sheet appears. Glance at it:
it should say the first week is free. Confirm the way the dry run showed you. Keep talking
while the app unlocks.*

> "This is the real App Store, so this is a real trial. The first week's free, and I can cancel
> any time before it ends. Premium is checked on the server, not the phone, so it waits a
> moment for the purchase to land... and there it is."

The pause is real: after the purchase the app polls the server for a few seconds before
unlocking. If the deck unlocks instantly, skip the pause.

### Beat 6 · 1:12–1:30 · `[PHONE]`
*Open the Ward Office deck. First card: **区役所**. Click to reveal and it speaks. Hold so all
four intervals are readable. Click **Good**. Second card, **市役所**: click **Easy**. On the
next card, click **Undo Easy** (just above the rating buttons), and 市役所 comes back.*

> "Kuyakusho: ward office. Every button shows when you'll see the card again, so you can rate
> it honestly. There's no red and no 'wrong'. And if I pick the wrong one, there's undo: the
> card comes right back."

### Beat 7 · 1:30–1:42 · `[PHONE]`
*Still in the session. Open Control Center, turn off **Wi-Fi** and **Cellular Data**, close it.
The offline banner appears. Rate the card. Open Control Center again and turn both back on.
The banner goes away as the answer syncs.*

> "It works on a plane, too. Answers wait on the phone and sync the moment you're back
> online."

### Beat 8 · 1:42–1:52 · `[PHONE]`
*Close the session. Go to the **Profile** tab and click the **reminder** row, so the 24-hour
picker shows.*

> "And thanks to OneSignal, One reminder a day, at the hour you pick, in your own timezone. And it
> stays quiet if you've already studied."

### Beat 9 · 1:52–2:02 · `[PHONE]`
*Go back from the reminder picker. Click the **Learn** tab, then the **kana chart** card. Click
**あ**. In the sheet, click the card so it speaks, then click the **stroke order** button (the
hand icon, top right).*

> "Kana is free, and it's a chart, not a deck. Every character speaks, and shows how it's
> written."

### Beat 10 · 2:02–2:10 · `[CAM]`

> "Ittekimasu is on the App Store now. The checklist, kana and N5 are free. Thanks for
> watching."

---

## If something goes wrong mid-take

| Problem | Say this, then do this |
|---|---|
| **Before** beat 5 | Stop and restart. Nothing has been bought yet. |
| Sheet doesn't say the first week is free | Click **Cancel** on the sheet. Stop the take. Switch to Plan B. |
| Purchase confirmed but the deck doesn't unlock after ~10 s | "...the server's still catching up, so let's keep going." Close the paywall, open **N5**, and run beat 6 on whatever card appears, skipping the kuyakusho line. |
| Mirroring disconnects | Stop. If it happened after the purchase, the trial is used; record Plan B. |
| Card doesn't speak | Keep going; don't mention it. Check the Mac's volume before the next take. |
| Offline banner doesn't appear | Cellular Data is probably still on. Turn it off; if it still doesn't appear, turn Wi-Fi back on and skip to beat 8 without the offline line. |
| Running long at 1:30 | Drop beat 7 (offline). Keep beat 8: it's the only place OneSignal is named, and Keep Them Coming Back is a target category. |

---

## Getting under 2:00

Apply these in order, re-timing after each, and stop as soon as you're under 1:55.

| # | Trim | Saves |
|---|---|---|
| 1 | Drop beat 7 (offline) entirely | ~12 s |
| 2 | Beat 5, shorter: *"Real App Store, real trial: first week free. Premium is checked on the server, so it takes a moment... and there it is."* | ~9 s |
| 3 | Beat 4, shorter: *"So there's a deck for exactly that, in Pro. And the paywall is honest: reviews are uncapped, but new cards stay paced at ten a deck each day."* | ~4 s |
| 4 | Beat 10, shorter: *"Ittekimasu is on the App Store now. Thanks for watching."* (beat 9 already says kana is free) | ~3 s |

Trims 1 and 2 together get the current script from ~2:20 to about 2:00; add 3 and 4 for
breathing room.

---

## Plan B: if the trial isn't available, the purchase needs the physical phone, or the take after the purchase goes wrong

Once the trial is used, the paywall won't appear on a retake, because the account is already
premium. Record the same take with the deck already unlocked, and describe the paywall
instead of showing it. Replace beats 4 and 5 with this one beat:

### Beat 4B · 0:38–0:58 · `[PHONE]`
*Click the Learn tab. The Ward Office deck is unlocked. Click it.*

> "So there's a deck for exactly that. It's part of Pro: seven-day free trial, reviews
> uncapped, and new cards paced at ten a deck each day, because cramming doesn't stick. And
> premium is checked on the server, never the phone."

Then carry on from beat 6. You lose the live purchase but keep everything else, and the
timings shift about 15 seconds earlier.

If the purchase confirmation needs the physical phone, you can still do the purchase for real
before recording (with the phone in your hand, outside the take), then record Plan B.

---

## After recording

- **Cancel the trial only when you've finished every take.** Cancelling locks the Ward Office
  deck immediately: `EntitlementService` treats RevenueCat's `CANCELLATION` event as the end
  of premium, rather than waiting for the trial to expire.
- Cancel in **Settings → [your name] → Subscriptions → Ittekimasu**, at least 24 hours before
  the trial ends, or Apple charges for the year.

---

## What each beat is doing for the judges

| Category | Where it's covered |
|---|---|
| Peace Prize | Beats 1–3: who it helps and why the problem is real |
| HAMM | Beats 4–5: an honest paywall, pacing disclosed, and a real App Store purchase unlocking a server-side entitlement |
| Design | Beats 6, 7 and 9: intervals on every button, no red, undo, answers that survive going offline, and stroke order |
| Keep Them Coming Back | Beat 8 names OneSignal on camera; the written submission adds the App ID and how it's wired (server-side cron, per-user timezone, skipped when there's nothing to do) |
| Build in Public | Beat 1: a real origin, told in your own voice |

Every Japanese word you'll say or show (区役所 kuyakusho, 市役所 shiyakusho) is a real card in
`V13__seed_premium_decks.sql`, in the order a freshly unlocked deck serves them.
