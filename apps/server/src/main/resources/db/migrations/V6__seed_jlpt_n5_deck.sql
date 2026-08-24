-- JLPT N5 core vocabulary, plus the two premium decks the learn tab shows as locked.
--
-- Card shape: front is the word as written, back is "reading · meaning". Readings are in
-- hiragana so the learner is always recalling the reading, not just the gloss.
--
-- Content note: this is standard N5 vocabulary, but it has not been checked against an
-- official JLPT list. Worth a proofread by a native or advanced speaker before launch —
-- a wrong reading teaches the wrong thing, and spaced repetition makes it stick.

INSERT INTO courses (id, title, topic, level, description, is_premium, sort_order, created_at,
                     updated_at)
VALUES (gen_random_uuid(), 'JLPT N5 Vocabulary', 'JLPT', 'N5',
        'The first 100 words. Enough to read signs and introduce yourself.',
        FALSE, 1, now(), now()),
       -- Listed but empty: the learn tab dims these and routes a tap to the paywall.
       (gen_random_uuid(), 'JLPT N4 Vocabulary', 'JLPT', 'N4',
        'The next step up, for everyday conversation.',
        TRUE, 2, now(), now()),
       (gen_random_uuid(), 'Ward Office Vocabulary', 'LIVING', 'PRACTICAL',
        'The words on the forms you will actually be handed.',
        TRUE, 3, now(), now());

INSERT INTO cards (id, course_id, front_text, back_text, card_type, sort_order, created_at,
                   updated_at)
SELECT gen_random_uuid(), c.id, v.front, v.back, 'VOCAB', v.sort_order, now(), now()
FROM courses c
         CROSS JOIN (VALUES
    -- People and family ---------------------------------------------------------------------
    ('私', 'わたし · I, me', 1),
    ('人', 'ひと · person', 2),
    ('男', 'おとこ · man', 3),
    ('女', 'おんな · woman', 4),
    ('子供', 'こども · child', 5),
    ('友達', 'ともだち · friend', 6),
    ('先生', 'せんせい · teacher', 7),
    ('学生', 'がくせい · student', 8),
    ('家族', 'かぞく · family', 9),
    ('父', 'ちち · (my) father', 10),
    ('母', 'はは · (my) mother', 11),
    ('兄', 'あに · older brother', 12),
    ('姉', 'あね · older sister', 13),
    ('弟', 'おとうと · younger brother', 14),
    ('妹', 'いもうと · younger sister', 15),

    -- Places --------------------------------------------------------------------------------
    ('家', 'いえ · house, home', 16),
    ('学校', 'がっこう · school', 17),
    ('会社', 'かいしゃ · company', 18),
    ('駅', 'えき · station', 19),
    ('店', 'みせ · shop', 20),
    ('病院', 'びょういん · hospital', 21),
    ('銀行', 'ぎんこう · bank', 22),
    ('郵便局', 'ゆうびんきょく · post office', 23),
    ('図書館', 'としょかん · library', 24),
    ('部屋', 'へや · room', 25),
    ('町', 'まち · town', 26),
    ('国', 'くに · country', 27),
    ('道', 'みち · road, street', 28),
    ('空港', 'くうこう · airport', 29),
    ('公園', 'こうえん · park', 30),

    -- Time ----------------------------------------------------------------------------------
    ('今日', 'きょう · today', 31),
    ('明日', 'あした · tomorrow', 32),
    ('昨日', 'きのう · yesterday', 33),
    ('今', 'いま · now', 34),
    ('朝', 'あさ · morning', 35),
    ('昼', 'ひる · noon, daytime', 36),
    ('夜', 'よる · night', 37),
    ('毎日', 'まいにち · every day', 38),
    ('時間', 'じかん · time, hour', 39),
    ('年', 'とし · year', 40),
    ('月', 'つき · moon, month', 41),
    ('今週', 'こんしゅう · this week', 42),
    ('午前', 'ごぜん · a.m., morning', 43),
    ('午後', 'ごご · p.m., afternoon', 44),
    ('曜日', 'ようび · day of the week', 45),

    -- Food ----------------------------------------------------------------------------------
    ('食べ物', 'たべもの · food', 46),
    ('水', 'みず · water', 47),
    ('お茶', 'おちゃ · tea', 48),
    ('ご飯', 'ごはん · rice, meal', 49),
    ('肉', 'にく · meat', 50),
    ('魚', 'さかな · fish', 51),
    ('野菜', 'やさい · vegetable', 52),
    ('果物', 'くだもの · fruit', 53),
    ('卵', 'たまご · egg', 54),
    ('牛乳', 'ぎゅうにゅう · milk', 55),
    ('天気', 'てんき · weather', 56),
    ('朝ご飯', 'あさごはん · breakfast', 57),

    -- Verbs ---------------------------------------------------------------------------------
    ('行く', 'いく · to go', 58),
    ('来る', 'くる · to come', 59),
    ('帰る', 'かえる · to return home', 60),
    ('食べる', 'たべる · to eat', 61),
    ('飲む', 'のむ · to drink', 62),
    ('見る', 'みる · to see, to watch', 63),
    ('聞く', 'きく · to listen, to ask', 64),
    ('話す', 'はなす · to speak', 65),
    ('読む', 'よむ · to read', 66),
    ('書く', 'かく · to write', 67),
    ('買う', 'かう · to buy', 68),
    ('働く', 'はたらく · to work', 69),
    ('休む', 'やすむ · to rest', 70),
    ('起きる', 'おきる · to get up', 71),
    ('寝る', 'ねる · to sleep', 72),
    ('分かる', 'わかる · to understand', 73),
    ('待つ', 'まつ · to wait', 74),
    ('会う', 'あう · to meet', 75),

    -- Adjectives ----------------------------------------------------------------------------
    ('大きい', 'おおきい · big', 76),
    ('小さい', 'ちいさい · small', 77),
    ('新しい', 'あたらしい · new', 78),
    ('古い', 'ふるい · old (things)', 79),
    ('高い', 'たかい · tall, expensive', 80),
    ('安い', 'やすい · cheap', 81),
    ('良い', 'よい · good', 82),
    ('悪い', 'わるい · bad', 83),
    ('暑い', 'あつい · hot (weather)', 84),
    ('寒い', 'さむい · cold (weather)', 85),
    ('忙しい', 'いそがしい · busy', 86),
    ('楽しい', 'たのしい · fun, enjoyable', 87),
    ('難しい', 'むずかしい · difficult', 88),
    ('面白い', 'おもしろい · interesting', 89),
    ('静か', 'しずか · quiet', 90),
    ('有名', 'ゆうめい · famous', 91),
    ('元気', 'げんき · well, energetic', 92),
    ('便利', 'べんり · convenient', 93),

    -- Everyday objects ----------------------------------------------------------------------
    ('本', 'ほん · book', 94),
    ('車', 'くるま · car', 95),
    ('電車', 'でんしゃ · train', 96),
    ('名前', 'なまえ · name', 97),
    ('電話', 'でんわ · telephone', 98),
    ('お金', 'おかね · money', 99),
    ('仕事', 'しごと · work, job', 100)
) AS v(front, back, sort_order)
WHERE c.topic = 'JLPT' AND c.level = 'N5';
