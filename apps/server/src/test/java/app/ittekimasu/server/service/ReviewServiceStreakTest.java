package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** The day-streak rule, with no database and no clock. */
class ReviewServiceStreakTest {

  private static final LocalDate TODAY = LocalDate.of(2026, 8, 27);

  @Test
  void firstEverStudyDayStartsAtOne() {
    assertThat(ReviewService.nextStreak(0, null, TODAY, true)).isEqualTo(1);
  }

  @Test
  void studyingOnConsecutiveDaysExtendsTheStreak() {
    assertThat(ReviewService.nextStreak(4, TODAY.minusDays(1), TODAY, false)).isEqualTo(5);
  }

  /** Restarts at 1, never 0 — the learner did study today. */
  @Test
  void aSkippedDayWithWorkAvailableRestartsAtOne() {
    assertThat(ReviewService.nextStreak(9, TODAY.minusDays(2), TODAY, false)).isEqualTo(1);
  }

  /**
   * The case this rule exists for. A first non-AGAIN answer schedules a card six days out, so
   * clearing a deck hands the learner nothing to do for most of a week. Losing the streak for
   * that is the algorithm punishing its own success.
   */
  @Test
  void aGapWithNothingDueKeepsTheStreak() {
    assertThat(ReviewService.nextStreak(9, TODAY.minusDays(6), TODAY, true)).isEqualTo(10);
  }

  /** An empty gap still cannot conjure a streak out of nothing. */
  @Test
  void anEmptyGapWithNoPreviousStudyDayStillStartsAtOne() {
    assertThat(ReviewService.nextStreak(0, null, TODAY, true)).isEqualTo(1);
  }
}
