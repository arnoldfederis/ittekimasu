package app.ittekimasu.server.service;

import app.ittekimasu.server.entity.ReviewRating;
import app.ittekimasu.server.entity.UserCardProgress;
import org.springframework.stereotype.Service;

/**
 * The SM-2 scheduler, and nothing else. Deliberately free of repositories and transactions so
 * the algorithm can be unit-tested directly — {@link ReviewService} owns the persistence.
 *
 * <pre>
 * AGAIN → interval = 1, ease -= 0.20 (floor 1.3), streak = 0
 * HARD  → ease -= 0.15 (floor 1.3), multiplier = 1.2
 * GOOD  → multiplier = ease
 * EASY  → ease += 0.15, multiplier = ease * 1.3
 *
 * interval = (interval == 1) ? 6 : round(interval * multiplier)
 * </pre>
 */
@Service
public class SpacedRepetitionService {

  public static final double STARTING_EASE = 2.5;
  public static final double MINIMUM_EASE = 1.3;

  /**
   * Where an unseen card starts. Combined with the {@code interval == 1 ? 6} rule this is the
   * classic SM-2 first-interval jump: the first confident answer schedules the card six days
   * out rather than crawling 1 → 2 → 3.
   */
  public static final int STARTING_INTERVAL_DAYS = 1;

  /** The state a card carries between reviews. */
  public record Schedule(double easeFactor, int intervalDays, int streakCount) {

    /** A card the learner has never seen. */
    public static Schedule newCard() {
      return new Schedule(STARTING_EASE, STARTING_INTERVAL_DAYS, 0);
    }

    public static Schedule of(UserCardProgress progress) {
      return progress == null
          ? newCard()
          : new Schedule(
              progress.getEaseFactor(), progress.getIntervalDays(), progress.getStreakCount());
    }
  }

  /** Applies one answer. Pure: same inputs, same outputs, no clock and no database. */
  public Schedule processReview(Schedule current, ReviewRating rating) {
    // AGAIN short-circuits the interval formula entirely: the card comes back tomorrow, and
    // the next correct answer takes the 1 → 6 jump again.
    if (rating == ReviewRating.AGAIN) {
      return new Schedule(floorEase(current.easeFactor() - 0.20), 1, 0);
    }

    double ease =
        switch (rating) {
          case HARD -> floorEase(current.easeFactor() - 0.15);
          case GOOD -> current.easeFactor();
          case EASY -> current.easeFactor() + 0.15;
          case AGAIN -> throw new IllegalStateException("handled above");
        };

    // HARD ignores ease for the multiplier: a struggled-through card should grow slowly no
    // matter how easy the learner used to find it.
    double multiplier =
        switch (rating) {
          case HARD -> 1.2;
          case GOOD -> ease;
          case EASY -> ease * 1.3;
          case AGAIN -> throw new IllegalStateException("handled above");
        };

    int intervalDays =
        current.intervalDays() == 1 ? 6 : (int) Math.round(current.intervalDays() * multiplier);

    return new Schedule(ease, Math.max(1, intervalDays), current.streakCount() + 1);
  }

  /** Convenience for the four buttons the review screen shows before the learner picks one. */
  public int projectInterval(Schedule current, ReviewRating rating) {
    return processReview(current, rating).intervalDays();
  }

  /**
   * Without the floor, a card the learner keeps missing drops its ease every time and ends up
   * scheduled every single day with no way back.
   */
  private double floorEase(double ease) {
    return Math.max(MINIMUM_EASE, ease);
  }
}
