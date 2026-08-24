package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.ittekimasu.server.entity.ReviewRating;
import app.ittekimasu.server.service.SpacedRepetitionService.Schedule;
import org.junit.jupiter.api.Test;

/** Pure algorithm, so no Spring context and no database. */
class SpacedRepetitionServiceTest {

  private static final double PRECISION = 0.0001;

  private final SpacedRepetitionService scheduler = new SpacedRepetitionService();

  @Test
  void aNewCardStartsAtEase2point5AndOneDay() {
    Schedule fresh = Schedule.newCard();

    assertThat(fresh.easeFactor()).isEqualTo(2.5);
    assertThat(fresh.intervalDays()).isEqualTo(1);
    assertThat(fresh.streakCount()).isZero();
  }

  @Test
  void goodOnAOneDayCardJumpsStraightToSixDays() {
    Schedule next = scheduler.processReview(Schedule.newCard(), ReviewRating.GOOD);

    assertThat(next.intervalDays()).isEqualTo(6);
    assertThat(next.easeFactor()).isEqualTo(2.5);
    assertThat(next.streakCount()).isEqualTo(1);
  }

  @Test
  void theOneToSixJumpAppliesToEveryNonAgainRating() {
    Schedule fresh = Schedule.newCard();

    assertThat(scheduler.processReview(fresh, ReviewRating.HARD).intervalDays()).isEqualTo(6);
    assertThat(scheduler.processReview(fresh, ReviewRating.GOOD).intervalDays()).isEqualTo(6);
    assertThat(scheduler.processReview(fresh, ReviewRating.EASY).intervalDays()).isEqualTo(6);
  }

  @Test
  void againSchedulesTomorrowAndClearsTheCardStreak() {
    Schedule current = new Schedule(2.5, 30, 4);

    Schedule next = scheduler.processReview(current, ReviewRating.AGAIN);

    assertThat(next.intervalDays()).isEqualTo(1);
    assertThat(next.streakCount()).isZero();
    assertThat(next.easeFactor()).isCloseTo(2.3, org.assertj.core.data.Offset.offset(PRECISION));
  }

  @Test
  void hardGrowsTheIntervalBy1point2AndTrimsEase() {
    Schedule next = scheduler.processReview(new Schedule(2.5, 10, 2), ReviewRating.HARD);

    assertThat(next.intervalDays()).isEqualTo(12);
    assertThat(next.easeFactor()).isCloseTo(2.35, org.assertj.core.data.Offset.offset(PRECISION));
    assertThat(next.streakCount()).isEqualTo(3);
  }

  @Test
  void goodMultipliesByTheEaseAndLeavesItAlone() {
    Schedule next = scheduler.processReview(new Schedule(2.5, 6, 1), ReviewRating.GOOD);

    // 6 * 2.5
    assertThat(next.intervalDays()).isEqualTo(15);
    assertThat(next.easeFactor()).isEqualTo(2.5);
    assertThat(next.streakCount()).isEqualTo(2);
  }

  @Test
  void easyRaisesEaseAndAddsThe1point3Bonus() {
    Schedule next = scheduler.processReview(new Schedule(2.5, 6, 1), ReviewRating.EASY);

    // ease 2.65, multiplier 2.65 * 1.3 = 3.445, 6 * 3.445 = 20.67 → 21
    assertThat(next.easeFactor()).isCloseTo(2.65, org.assertj.core.data.Offset.offset(PRECISION));
    assertThat(next.intervalDays()).isEqualTo(21);
    assertThat(next.streakCount()).isEqualTo(2);
  }

  @Test
  void easeNeverFallsBelow1point3ThroughAgain() {
    Schedule next = scheduler.processReview(new Schedule(1.4, 12, 3), ReviewRating.AGAIN);

    assertThat(next.easeFactor()).isEqualTo(SpacedRepetitionService.MINIMUM_EASE);
  }

  @Test
  void easeNeverFallsBelow1point3ThroughHard() {
    Schedule next = scheduler.processReview(new Schedule(1.4, 12, 3), ReviewRating.HARD);

    assertThat(next.easeFactor()).isEqualTo(SpacedRepetitionService.MINIMUM_EASE);
  }

  @Test
  void repeatedAgainAnswersStayAtTheFloorRatherThanDivergingDownward() {
    Schedule current = new Schedule(2.5, 20, 5);

    for (int i = 0; i < 10; i++) {
      current = scheduler.processReview(current, ReviewRating.AGAIN);
    }

    assertThat(current.easeFactor()).isEqualTo(SpacedRepetitionService.MINIMUM_EASE);
    assertThat(current.intervalDays()).isEqualTo(1);
  }

  @Test
  void aLapsedCardTakesTheOneToSixJumpAgainOnTheNextGood() {
    Schedule lapsed = scheduler.processReview(new Schedule(2.5, 30, 4), ReviewRating.AGAIN);

    Schedule recovered = scheduler.processReview(lapsed, ReviewRating.GOOD);

    assertThat(recovered.intervalDays()).isEqualTo(6);
    assertThat(recovered.streakCount()).isEqualTo(1);
  }

  @Test
  void projectIntervalMatchesWhatTheRatingWouldActuallyDo() {
    Schedule current = new Schedule(2.5, 6, 1);

    assertThat(scheduler.projectInterval(current, ReviewRating.AGAIN)).isEqualTo(1);
    assertThat(scheduler.projectInterval(current, ReviewRating.HARD)).isEqualTo(7);
    assertThat(scheduler.projectInterval(current, ReviewRating.GOOD)).isEqualTo(15);
    assertThat(scheduler.projectInterval(current, ReviewRating.EASY)).isEqualTo(21);
  }
}
