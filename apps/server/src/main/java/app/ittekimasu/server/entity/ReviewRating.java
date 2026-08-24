package app.ittekimasu.server.entity;

/**
 * How well the learner recalled a card.
 *
 * <p>AGAIN is a neutral scheduling signal, not a failure — the whole product runs on positive
 * reinforcement, so nothing in the UI or the copy may treat it as getting the card "wrong".
 */
public enum ReviewRating {
  AGAIN,
  HARD,
  GOOD,
  EASY
}
