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
 * New-card pacing: a session may hand over everything DUE, but only so many cards the
 * learner has never met.
 *
 * <p>Needs Postgres running (`devbox run dev up`), and a free deck with more cards than the
 * daily intake — the seeded kana decks are 104 each.
 */
@SpringBootTest
@Transactional
class ReviewServicePacingIntegrationTest {

  @Autowired private ReviewService reviewService;
  @Autowired private UserRepository userRepository;
  @Autowired private CourseRepository courseRepository;

  private User user;
  private Course deck;

  @BeforeEach
  void setUp() {
    user = new User();
    user.setFirebaseUid("pacing-test-" + UUID.randomUUID());
    user.setEmail("pacing-test@ittekimasu.app");
    user = userRepository.save(user);

    deck =
        courseRepository.findAll().stream()
            .filter(course -> !course.isPremium())
            .findFirst()
            .orElseThrow();
  }

  @Test
  void aFirstSessionIsCappedAtTheDailyIntakeRatherThanTheWholeDeck() {
    var session = reviewService.listDue(user.getId(), deck.getId());

    assertThat(session.totalCardCount()).isGreaterThan(ReviewService.NEW_CARDS_PER_DAY);
    assertThat(session.cards()).hasSize(ReviewService.NEW_CARDS_PER_DAY);
    assertThat(session.newCardsRemainingToday()).isEqualTo(ReviewService.NEW_CARDS_PER_DAY);
    // The rest of the deck is still there, waiting — not finished.
    assertThat(session.unseenCardCount()).isEqualTo(session.totalCardCount());
  }

  @Test
  void answeringTodaysIntakeEmptiesTheSessionWithoutEmptyingTheDeck() {
    var first = reviewService.listDue(user.getId(), deck.getId());
    for (var card : first.cards()) {
      reviewService.submitReview(user.getId(), card.id(), ReviewRating.GOOD);
    }

    var second = reviewService.listDue(user.getId(), deck.getId());

    // Nothing left to do today...
    assertThat(second.cards()).isEmpty();
    assertThat(second.newCardsRemainingToday()).isZero();
    // ...but the deck is a long way from done, which is what stops the client saying
    // "All caught up" over ninety unlearned cards.
    assertThat(second.unseenCardCount()).isGreaterThan(0);
  }

  /** Pacing bounds NEW cards only. A day with nothing new still owes the learner its reviews. */
  @Test
  void theIntakeIsSharedAcrossDecksBecauseItCountsCardsNotDecks() {
    var first = reviewService.listDue(user.getId(), deck.getId());
    for (var card : first.cards()) {
      reviewService.submitReview(user.getId(), card.id(), ReviewRating.GOOD);
    }

    Course otherDeck =
        courseRepository.findAll().stream()
            .filter(course -> !course.isPremium() && !course.getId().equals(deck.getId()))
            .findFirst()
            .orElseThrow();

    assertThat(reviewService.listDue(user.getId(), otherDeck.getId()).cards()).isEmpty();
  }
}
