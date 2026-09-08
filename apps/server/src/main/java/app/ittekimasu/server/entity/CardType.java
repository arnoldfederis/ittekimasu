package app.ittekimasu.server.entity;

/**
 * Shape of a card.
 *
 * <p>Every value here must exist before a migration seeds it: card_type is a plain VARCHAR
 * with no check constraint, so an unknown string inserts happily and then fails at read time
 * when Hibernate cannot map it back — which takes out the whole deck, not one card.
 */
public enum CardType {
  VOCAB,
  /*
   * KANA was here until V16. Kana is no longer a deck — the chart ships in the client
   * (apps/mobile/src/constants/kana.ts) because a syllabary is a table to read off, not
   * material to schedule. V16 deletes the last rows that used this value; do not re-add the
   * constant without re-adding cards that need it.
   */
  GRAMMAR,
  KANJI,
  PHRASE
}
