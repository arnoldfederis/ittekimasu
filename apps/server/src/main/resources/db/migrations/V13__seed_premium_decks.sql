-- Fills the three premium decks, which until now existed as empty rows.
--
-- Anyone who subscribed got a higher daily cap and two decks with nothing in them. That is
-- the kind of thing App Review rejects and a trial user asks for a refund over.
--
-- N3 is created here rather than in V6: the paywall already promises "N4 and N3", so the
-- deck has to exist for that sentence to be true.
--
-- Card shape matches V6 — front is the word as written, back is "reading · meaning", the
-- reading in hiragana so the learner recalls the reading rather than only the gloss.
--
-- CONTENT NOTE, same as V6 and just as important: this vocabulary is standard for its level
-- but has NOT been checked against an official JLPT list, and the ward-office deck is not
-- immigration guidance. A wrong reading is worse than a missing card, because spaced
-- repetition makes it stick. Worth a proofread by a native or advanced speaker before
-- launch.

-- N3 slots between N4 and the practical deck.
UPDATE courses
SET sort_order = 6,
    updated_at = now()
WHERE topic = 'LIVING' AND level = 'PRACTICAL';

INSERT INTO courses (id, title, topic, level, description, is_premium, sort_order, created_at,
                     updated_at)
VALUES (gen_random_uuid(), 'JLPT N3 Vocabulary', 'JLPT', 'N3',
        'The words that show up in contracts, forms and the news.',
        TRUE, 5, now(), now());

-- N4 --------------------------------------------------------------------------------------
INSERT INTO cards (id, course_id, front_text, back_text, card_type, sort_order, created_at,
                   updated_at)
SELECT gen_random_uuid(), c.id, v.front, v.back, 'VOCAB', v.sort_order, now(), now()
FROM courses c
         CROSS JOIN (VALUES
    -- People ---------------------------------------------------------------------------
    ('主人', 'しゅじん · husband', 1),
    ('家内', 'かない · (my) wife', 2),
    ('息子', 'むすこ · son', 3),
    ('娘', 'むすめ · daughter', 4),
    ('祖父', 'そふ · grandfather', 5),
    ('祖母', 'そぼ · grandmother', 6),
    ('親', 'おや · parent', 7),
    ('客', 'きゃく · guest, customer', 8),
    ('店員', 'てんいん · shop assistant', 9),
    ('社長', 'しゃちょう · company president', 10),
    ('部長', 'ぶちょう · department manager', 11),
    ('課長', 'かちょう · section chief', 12),
    ('友人', 'ゆうじん · friend (formal)', 13),
    ('近所', 'きんじょ · neighbourhood', 14),
    ('世界', 'せかい · world', 15),

    -- Work and study -------------------------------------------------------------------
    ('会議', 'かいぎ · meeting', 16),
    ('事務所', 'じむしょ · office', 17),
    ('工場', 'こうじょう · factory', 18),
    ('受付', 'うけつけ · reception', 19),
    ('説明', 'せつめい · explanation', 20),
    ('準備', 'じゅんび · preparation', 21),
    ('経験', 'けいけん · experience', 22),
    ('予定', 'よてい · plan, schedule', 23),
    ('約束', 'やくそく · promise, appointment', 24),
    ('相談', 'そうだん · consultation', 25),
    ('意見', 'いけん · opinion', 26),
    ('返事', 'へんじ · reply', 27),
    ('連絡', 'れんらく · getting in touch', 28),
    ('場合', 'ばあい · case, situation', 29),
    ('理由', 'りゆう · reason', 30),

    -- Daily life -----------------------------------------------------------------------
    ('生活', 'せいかつ · daily life', 31),
    ('習慣', 'しゅうかん · custom, habit', 32),
    ('用事', 'ようじ · errand', 33),
    ('掃除', 'そうじ · cleaning', 34),
    ('洗濯', 'せんたく · laundry', 35),
    ('料理', 'りょうり · cooking, dish', 36),
    ('買い物', 'かいもの · shopping', 37),
    ('引っ越し', 'ひっこし · moving house', 38),
    ('荷物', 'にもつ · luggage, parcel', 39),
    ('都合', 'つごう · convenience, circumstances', 40),

    -- Places ---------------------------------------------------------------------------
    ('郊外', 'こうがい · suburbs', 41),
    ('都会', 'とかい · the city', 42),
    ('田舎', 'いなか · countryside', 43),
    ('駐車場', 'ちゅうしゃじょう · car park', 44),
    ('交差点', 'こうさてん · intersection', 45),
    ('信号', 'しんごう · traffic light', 46),
    ('横断歩道', 'おうだんほどう · pedestrian crossing', 47),
    ('港', 'みなと · harbour', 48),
    ('大使館', 'たいしかん · embassy', 49),
    ('寺', 'てら · temple', 50),
    ('神社', 'じんじゃ · shrine', 51),
    ('美術館', 'びじゅつかん · art museum', 52),
    ('動物園', 'どうぶつえん · zoo', 53),
    ('工事', 'こうじ · construction work', 54),

    -- Health ---------------------------------------------------------------------------
    ('具合', 'ぐあい · condition (of health)', 55),
    ('熱', 'ねつ · fever', 56),
    ('風邪', 'かぜ · a cold', 57),
    ('怪我', 'けが · injury', 58),
    ('注射', 'ちゅうしゃ · injection', 59),
    ('入院', 'にゅういん · hospital admission', 60),
    ('退院', 'たいいん · leaving hospital', 61),
    ('歯医者', 'はいしゃ · dentist', 62),

    -- Travel ---------------------------------------------------------------------------
    ('旅館', 'りょかん · Japanese inn', 63),
    ('予約', 'よやく · reservation', 64),
    ('出発', 'しゅっぱつ · departure', 65),
    ('到着', 'とうちゃく · arrival', 66),
    ('乗り換え', 'のりかえ · changing trains', 67),
    ('片道', 'かたみち · one way', 68),
    ('往復', 'おうふく · round trip', 69),
    ('指定席', 'していせき · reserved seat', 70),
    ('自由席', 'じゆうせき · unreserved seat', 71),
    ('特急', 'とっきゅう · limited express', 72),

    -- Money ----------------------------------------------------------------------------
    ('給料', 'きゅうりょう · salary', 73),
    ('財布', 'さいふ · wallet', 74),
    ('値段', 'ねだん · price', 75),
    ('税金', 'ぜいきん · tax', 76),
    ('貯金', 'ちょきん · savings', 77),
    ('支払い', 'しはらい · payment', 78),
    ('経済', 'けいざい · economy', 79),
    ('無料', 'むりょう · free of charge', 80),

    -- Ideas ----------------------------------------------------------------------------
    ('気持ち', 'きもち · feeling', 81),
    ('気分', 'きぶん · mood', 82),
    ('興味', 'きょうみ · interest', 83),
    ('趣味', 'しゅみ · hobby', 84),
    ('夢', 'ゆめ · dream', 85),
    ('性格', 'せいかく · personality', 86),
    ('会話', 'かいわ · conversation', 87),
    ('文化', 'ぶんか · culture', 88),
    ('歴史', 'れきし · history', 89),
    ('政治', 'せいじ · politics', 90),
    ('科学', 'かがく · science', 91),
    ('教育', 'きょういく · education', 92),
    ('研究', 'けんきゅう · research', 93),
    ('技術', 'ぎじゅつ · technology, skill', 94),
    ('機会', 'きかい · opportunity', 95),
    ('安全', 'あんぜん · safety', 96),
    ('危険', 'きけん · danger', 97),
    ('注意', 'ちゅうい · caution', 98),
    ('規則', 'きそく · rule', 99),
    ('失敗', 'しっぱい · failure, mistake', 100)
) AS v(front, back, sort_order)
WHERE c.topic = 'JLPT' AND c.level = 'N4';

-- N3 --------------------------------------------------------------------------------------
INSERT INTO cards (id, course_id, front_text, back_text, card_type, sort_order, created_at,
                   updated_at)
SELECT gen_random_uuid(), c.id, v.front, v.back, 'VOCAB', v.sort_order, now(), now()
FROM courses c
         CROSS JOIN (VALUES
    -- Thinking and judgement -----------------------------------------------------------
    ('影響', 'えいきょう · influence', 1),
    ('状況', 'じょうきょう · situation', 2),
    ('印象', 'いんしょう · impression', 3),
    ('記憶', 'きおく · memory', 4),
    ('判断', 'はんだん · judgement', 5),
    ('態度', 'たいど · attitude', 6),
    ('表現', 'ひょうげん · expression', 7),
    ('意識', 'いしき · awareness', 8),
    ('感覚', 'かんかく · sense, feeling', 9),
    ('感情', 'かんじょう · emotion', 10),
    ('想像', 'そうぞう · imagination', 11),
    ('常識', 'じょうしき · common sense', 12),
    ('知識', 'ちしき · knowledge', 13),
    ('情報', 'じょうほう · information', 14),
    ('内容', 'ないよう · content', 15),

    -- Paperwork and rules --------------------------------------------------------------
    ('制度', 'せいど · system (institutional)', 16),
    ('政府', 'せいふ · government', 17),
    ('責任', 'せきにん · responsibility', 18),
    ('義務', 'ぎむ · duty, obligation', 19),
    ('権利', 'けんり · right, entitlement', 20),
    ('資料', 'しりょう · materials, documents', 21),
    ('資格', 'しかく · qualification', 22),
    ('契約', 'けいやく · contract', 23),
    ('手続き', 'てつづき · procedure, paperwork', 24),
    ('申請', 'しんせい · application (formal)', 25),
    ('許可', 'きょか · permission', 26),
    ('提出', 'ていしゅつ · submission', 27),
    ('確認', 'かくにん · confirmation', 28),
    ('変更', 'へんこう · change, alteration', 29),
    ('延長', 'えんちょう · extension', 30),
    ('更新', 'こうしん · renewal', 31),
    ('登録', 'とうろく · registration', 32),
    ('発行', 'はっこう · issuance', 33),
    ('期限', 'きげん · deadline', 34),
    ('有効', 'ゆうこう · valid', 35),

    -- Numbers and money ----------------------------------------------------------------
    ('不足', 'ふそく · shortage', 36),
    ('増加', 'ぞうか · increase', 37),
    ('減少', 'げんしょう · decrease', 38),
    ('平均', 'へいきん · average', 39),
    ('割合', 'わりあい · proportion', 40),
    ('合計', 'ごうけい · total', 41),
    ('費用', 'ひよう · expense', 42),
    ('収入', 'しゅうにゅう · income', 43),
    ('支出', 'ししゅつ · expenditure', 44),
    ('家賃', 'やちん · rent', 45),
    ('保証', 'ほしょう · guarantee', 46),
    ('保険', 'ほけん · insurance', 47),
    ('年金', 'ねんきん · pension', 48),

    -- Work -----------------------------------------------------------------------------
    ('就職', 'しゅうしょく · finding employment', 49),
    ('転職', 'てんしょく · changing jobs', 50),
    ('面接', 'めんせつ · interview', 51),
    ('履歴書', 'りれきしょ · CV, résumé', 52),
    ('残業', 'ざんぎょう · overtime', 53),
    ('出張', 'しゅっちょう · business trip', 54),
    ('休憩', 'きゅうけい · break, rest', 55),
    ('有給', 'ゆうきゅう · paid leave', 56),
    ('期待', 'きたい · expectation', 57),
    ('努力', 'どりょく · effort', 58),
    ('成功', 'せいこう · success', 59),
    ('実現', 'じつげん · realisation', 60),
    ('目標', 'もくひょう · goal', 61),
    ('計画', 'けいかく · plan', 62),
    ('実行', 'じっこう · carrying out', 63),

    -- Cause and effect -----------------------------------------------------------------
    ('解決', 'かいけつ · solution', 64),
    ('課題', 'かだい · issue, task', 65),
    ('原因', 'げんいん · cause', 66),
    ('結果', 'けっか · result', 67),
    ('効果', 'こうか · effect', 68),
    ('傾向', 'けいこう · tendency', 69),
    ('特徴', 'とくちょう · characteristic', 70),
    ('種類', 'しゅるい · kind, type', 71),

    -- Time -----------------------------------------------------------------------------
    ('期間', 'きかん · period of time', 72),
    ('瞬間', 'しゅんかん · moment', 73),
    ('現在', 'げんざい · the present', 74),
    ('過去', 'かこ · the past', 75),
    ('未来', 'みらい · the future', 76),
    ('将来', 'しょうらい · one''s future', 77),
    ('世代', 'せだい · generation', 78),

    -- Environment and risk -------------------------------------------------------------
    ('環境', 'かんきょう · environment', 79),
    ('自然', 'しぜん · nature', 80),
    ('資源', 'しげん · resources', 81),
    ('汚染', 'おせん · pollution', 82),
    ('災害', 'さいがい · disaster', 83),
    ('地震', 'じしん · earthquake', 84),
    ('台風', 'たいふう · typhoon', 85),
    ('避難', 'ひなん · evacuation', 86),
    ('被害', 'ひがい · damage', 87),
    ('対策', 'たいさく · countermeasure', 88),

    -- People and manners ---------------------------------------------------------------
    ('協力', 'きょうりょく · cooperation', 89),
    ('参加', 'さんか · participation', 90),
    ('交流', 'こうりゅう · exchange, interaction', 91),
    ('関係', 'かんけい · relationship', 92),
    ('立場', 'たちば · standpoint', 93),
    ('相手', 'あいて · the other party', 94),
    ('先輩', 'せんぱい · senior colleague', 95),
    ('後輩', 'こうはい · junior colleague', 96),
    ('敬語', 'けいご · honorific language', 97),
    ('挨拶', 'あいさつ · greeting', 98),
    ('遠慮', 'えんりょ · restraint, holding back', 99),
    ('迷惑', 'めいわく · trouble, nuisance', 100)
) AS v(front, back, sort_order)
WHERE c.topic = 'JLPT' AND c.level = 'N3';

-- Ward office ------------------------------------------------------------------------------
-- The deck this app exists for: the words on the forms someone is actually handed in their
-- first fortnight. Ordered the way the errands happen, not alphabetically.
INSERT INTO cards (id, course_id, front_text, back_text, card_type, sort_order, created_at,
                   updated_at)
SELECT gen_random_uuid(), c.id, v.front, v.back, 'VOCAB', v.sort_order, now(), now()
FROM courses c
         CROSS JOIN (VALUES
    -- Where you are going --------------------------------------------------------------
    ('区役所', 'くやくしょ · ward office', 1),
    ('市役所', 'しやくしょ · city hall', 2),
    ('窓口', 'まどぐち · service counter', 3),
    ('受付番号', 'うけつけばんごう · queue number', 4),
    ('担当者', 'たんとうしゃ · person in charge', 5),

    -- Residence ------------------------------------------------------------------------
    ('住民票', 'じゅうみんひょう · certificate of residence', 6),
    ('転入届', 'てんにゅうとどけ · moving-in notification', 7),
    ('転出届', 'てんしゅつとどけ · moving-out notification', 8),
    ('転居届', 'てんきょとどけ · change-of-address notification', 9),
    ('世帯主', 'せたいぬし · head of household', 10),
    ('現住所', 'げんじゅうしょ · current address', 11),
    ('本籍', 'ほんせき · registered domicile', 12),

    -- Immigration ----------------------------------------------------------------------
    ('在留カード', 'ざいりゅうカード · residence card', 13),
    ('在留資格', 'ざいりゅうしかく · residence status', 14),
    ('在留期間', 'ざいりゅうきかん · period of stay', 15),
    ('永住権', 'えいじゅうけん · permanent residency', 16),
    ('再入国許可', 'さいにゅうこくきょか · re-entry permit', 17),
    ('資格外活動許可', 'しかくがいかつどうきょか · permission to work outside your status', 18),
    ('入国管理局', 'にゅうこくかんりきょく · immigration bureau', 19),

    -- Identity -------------------------------------------------------------------------
    ('個人番号', 'こじんばんごう · individual number (My Number)', 20),
    ('本人確認', 'ほんにんかくにん · identity verification', 21),
    ('身分証明書', 'みぶんしょうめいしょ · identification document', 22),
    ('生年月日', 'せいねんがっぴ · date of birth', 23),
    ('国籍', 'こくせき · nationality', 24),

    -- Seals ----------------------------------------------------------------------------
    ('印鑑', 'いんかん · personal seal', 25),
    ('実印', 'じついん · registered seal', 26),
    ('印鑑登録', 'いんかんとうろく · seal registration', 27),
    ('印鑑証明', 'いんかんしょうめい · seal certificate', 28),
    ('押印', 'おういん · affixing a seal', 29),
    ('署名', 'しょめい · signature', 30),

    -- Insurance, pension, tax ----------------------------------------------------------
    ('国民健康保険', 'こくみんけんこうほけん · national health insurance', 31),
    ('健康保険証', 'けんこうほけんしょう · health insurance card', 32),
    ('国民年金', 'こくみんねんきん · national pension', 33),
    ('厚生年金', 'こうせいねんきん · employees pension', 34),
    ('住民税', 'じゅうみんぜい · residence tax', 35),
    ('所得税', 'しょとくぜい · income tax', 36),
    ('源泉徴収票', 'げんせんちょうしゅうひょう · withholding tax statement', 37),
    ('確定申告', 'かくていしんこく · final tax return', 38),
    ('課税証明書', 'かぜいしょうめいしょ · tax certificate', 39),
    ('納付書', 'のうふしょ · payment slip', 40),

    -- Paperwork itself -----------------------------------------------------------------
    ('申請書', 'しんせいしょ · application form', 41),
    ('記入', 'きにゅう · filling in a form', 42),
    ('提出書類', 'ていしゅつしょるい · documents to submit', 43),
    ('添付', 'てんぷ · attachment', 44),
    ('原本', 'げんぽん · original document', 45),
    ('写し', 'うつし · copy', 46),
    ('手数料', 'てすうりょう · handling fee', 47),
    ('発行日', 'はっこうび · date of issue', 48),
    ('有効期限', 'ゆうこうきげん · expiry date', 49),

    -- Settling in ----------------------------------------------------------------------
    ('銀行口座', 'ぎんこうこうざ · bank account', 50),
    ('口座振替', 'こうざふりかえ · direct debit', 51),
    ('給与明細', 'きゅうよめいさい · pay slip', 52),
    ('保証人', 'ほしょうにん · guarantor', 53),
    ('水道', 'すいどう · water supply', 54),
    ('粗大ごみ', 'そだいごみ · oversized rubbish', 55)
) AS v(front, back, sort_order)
WHERE c.topic = 'LIVING' AND c.level = 'PRACTICAL';
