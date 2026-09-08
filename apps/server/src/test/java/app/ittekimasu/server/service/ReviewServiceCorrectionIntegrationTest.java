package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.ittekimasu.server.entity.Course;
import app.ittekimasu.server.entity.ReviewRating;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.repository.CourseRepository;
import app.ittekimasu.server.repository.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Correcting a difficulty in the browser must be idempotent.
 *
 * <p>The bug this pins down: applying SM-2 to the CURRENT state compounds, so tapping Easy
 * three times took a card from 6 days to 21 to 76 to 289. A correction is not a review.
 *
 * <p>Needs Postgres running (`devbox run dev up`).
 */
@SpringBootTest
@Transactional
class ReviewServiceCorrectionIntegrationTest {

  @Autowired private ReviewService reviewService;
  @Autowired private UserRepository userRepository;
  @Autowired private CourseRepository courseRepository;

  private User user;
  private UUID cardId;

  @BeforeEach
  void setUp() {
    user = new User();
    user.setFirebaseUid("correction-test-" + UUID.randomUUID());
    user.setEmail("correction-test@ittekimasu.app");
    user = userRepository.save(user);

    Course deck =
        courseRepository.findAll().stream().filter(course -> !course.isPremium()).findFirst()
            .orElseThrow();

    // One real answer, so the card has a schedule and an undo snapshot to be measured from.
    cardId = reviewService.listDue(user.getId(), deck.getId()).cards().getFirst().id();
    reviewService.submitReview(user.getId(), cardId, ReviewRating.GOOD);
  }

  @Test
  void correctingTheSameWayTwiceLandsOnTheSameSchedule() {
    var once = reviewService.correctRating(user.getId(), cardId, ReviewRating.EASY);
    var twice = reviewService.correctRating(user.getId(), cardId, ReviewRating.EASY);
    var thrice = reviewService.correctRating(user.getId(), cardId, ReviewRating.EASY);

    assertThat(twice.intervalDays()).isEqualTo(once.intervalDays());
    assertThat(thrice.intervalDays()).isEqualTo(once.intervalDays());
    assertThat(thrice.nextReviewDate()).isEqualTo(once.nextReviewDate());
  }

  /** Changing your mind repeatedly must end where going straight there would have. */
  @Test
  void theLastCorrectionWinsRegardlessOfTheRouteTaken() {
    reviewService.correctRating(user.getId(), cardId, ReviewRating.EASY);
    reviewService.correctRating(user.getId(), cardId, ReviewRating.AGAIN);
    var settled = reviewService.correctRating(user.getId(), cardId, ReviewRating.HARD);

    var direct = correctFreshCardTo(ReviewRating.HARD);

    assertThat(settled.intervalDays()).isEqualTo(direct.intervalDays());
  }

  @Test
  void correctingDoesNotSpendTheDailyAllowance() {
    var deck = courseRepository.findAll().stream().filter(c -> !c.isPremium()).findFirst()
        .orElseThrow();
    int before = reviewService.listDue(user.getId(), deck.getId()).reviewedToday();

    reviewService.correctRating(user.getId(), cardId, ReviewRating.EASY);

    assertThat(reviewService.listDue(user.getId(), deck.getId()).reviewedToday())
        .isEqualTo(before);
  }

  /** A second account at the same starting point, corrected once, to compare against. */
  private app.ittekimasu.server.dto.response.SeenCardResponse correctFreshCardTo(
      ReviewRating rating) {
    User other = new User();
    other.setFirebaseUid("correction-test-" + UUID.randomUUID());
    other.setEmail("correction-test@ittekimasu.app");
    other = userRepository.save(other);

    Course deck =
        courseRepository.findAll().stream().filter(course -> !course.isPremium()).findFirst()
            .orElseThrow();
    UUID otherCard = reviewService.listDue(other.getId(), deck.getId()).cards().getFirst().id();
    reviewService.submitReview(other.getId(), otherCard, ReviewRating.GOOD);
    return reviewService.correctRating(other.getId(), otherCard, rating);
  }
}
