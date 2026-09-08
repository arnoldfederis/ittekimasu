-- Kana stops being a deck.
--
-- V11 seeded hiragana and katakana as two 104-card courses scheduled by SM-2 like any
-- vocabulary deck. That was the wrong shape for the material: a syllabary is a table you
-- learn to read off, not 104 independent facts, and pushing あ six days out for being
-- answered correctly is the algorithm working against the thing it is teaching. It also put
-- an exam in front of the first ten minutes of the app.
--
-- The chart now lives in the client (apps/mobile/src/constants/kana.ts), which is why these
-- rows can go rather than merely being hidden: it needs no request, works offline from a
-- cold start, and records nothing against the learner. Kana stays free — more so than
-- before, since it no longer spends anyone's twenty daily reviews.
--
-- The two cascades do the work here: cards -> courses (V5) and user_card_progress -> cards
-- (V7) are both ON DELETE CASCADE, so deleting the courses removes the 208 cards and every
-- progress row pointing at them. Study days and streaks are untouched on purpose — those
-- record days the learner really did turn up, and reshaping a deck does not un-happen them.
DELETE
FROM courses
WHERE topic = 'KANA';

-- Close the gap the two decks leave at the top. Ordering by sort_order is what the learn tab
-- renders by, and starting at 3 would be a puzzle for the next person reading the table.
UPDATE courses
SET sort_order = sort_order - 2,
    updated_at = now()
WHERE sort_order > 2;
