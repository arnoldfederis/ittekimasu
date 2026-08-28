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
  /** A single kana. Back is romaji, not `reading · meaning` — the character IS the reading. */
  KANA,
  GRAMMAR,
  KANJI,
  PHRASE
}
