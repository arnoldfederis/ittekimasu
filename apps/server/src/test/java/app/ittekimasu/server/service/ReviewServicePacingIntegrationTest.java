package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.ittekimasu.server.entity.Card;
import app.ittekimasu.server.entity.CardType;
import app.ittekimasu.server.entity.Course;
import app.ittekimasu.server.entity.Entitlement;
import app.ittekimasu.server.entity.ReviewRating;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.repository.CardRepository;
import app.ittekimasu.server.repository.CourseRepository;
import app.ittekimasu.server.repository.EntitlementRepository;
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
 * daily intake — the seeded N5 deck is 100.
 *
 * <p>The second deck is built here rather than taken from the seed. It used to be one of the
 * kana decks, which V16 removed; a test that depends on how many free decks the seed happens
 * to ship breaks every time the catalogue changes, which is not what it is testing.
 */
@SpringBootTest
@Transactional
class ReviewServicePacingIntegrationTest {

  @Autowired private ReviewService reviewService;
  @Autowired private UserRepository userRepository;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CardRepository cardRepository;
  @Autowired private EntitlementRepository entitlementRepository;

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

    assertThat(session.totalCardCount()).isGreaterThan(ReviewService.NEW_CARDS_PER_DECK_PER_DAY);
    assertThat(session.cards()).hasSize(ReviewService.NEW_CARDS_PER_DECK_PER_DAY);
    assertThat(session.newCardsRemainingToday()).isEqualTo(ReviewService.NEW_CARDS_PER_DECK_PER_DAY);
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

  /**
   * The intake is PER DECK. Finishing today's ten in one deck must not empty another, or a
   * subscriber who just unlocked three decks gets exactly what they had before paying.
   */
  @Test
  void eachDeckHasItsOwnDailyIntake() {
    var first = reviewService.listDue(user.getId(), deck.getId());
    for (var card : first.cards()) {
      reviewService.submitReview(user.getId(), card.id(), ReviewRating.GOOD);
    }

    // The deck that was just exhausted stays empty for today...
    assertThat(reviewService.listDue(user.getId(), deck.getId()).cards()).isEmpty();

    // ...but a different deck still offers its own ten.
    Course otherDeck = freeDeckWithCards(5);
    assertThat(reviewService.listDue(user.getId(), otherDeck.getId()).cards()).hasSize(5);
  }

  /**
   * The day-wide ceiling still bites. Ten per deck across four decks would be forty new cards
   * in an evening, which is the cramming the pacing exists to prevent.
   */
  @Test
  void theDayWideCeilingCapsTheTotalAcrossDecks() {
    // Premium, because a free user meets FREE_DAILY_REVIEW_LIMIT (20) before the 30-card
    // ceiling can ever bite. The ceiling exists for subscribers with several decks open.
    makePremium();

    // Three decks' worth of intake, answered.
    int answered = 0;
    for (int i = 0; i < 3; i++) {
      Course extra = freeDeckWithCards(ReviewService.NEW_CARDS_PER_DECK_PER_DAY);
      for (var card : reviewService.listDue(user.getId(), extra.getId()).cards()) {
        reviewService.submitReview(user.getId(), card.id(), ReviewRating.GOOD);
        answered++;
      }
    }

    assertThat(answered).isEqualTo(ReviewService.NEW_CARDS_PER_DAY_TOTAL);

    // A fourth, untouched deck now offers nothing: the ceiling is spent even though this
    // deck's own ten are all still unmet.
    Course fourth = freeDeckWithCards(10);
    assertThat(reviewService.listDue(user.getId(), fourth.getId()).cards()).isEmpty();
  }

  /** Premium via the entitlements table, which is the only thing the server reads. */
  private void makePremium() {
    Entitlement entitlement = new Entitlement();
    entitlement.setUser(user);
    entitlement.setPremium(true);
    entitlementRepository.save(entitlement);
  }

  /** A free deck with {@code cardCount} cards, built here so the test does not depend on the
   * seeded catalogue. */
  private Course freeDeckWithCards(int cardCount) {
    Course course = new Course();
    course.setTitle("Pacing fixture");
    course.setTopic("TEST");
    // topic + level is unique, and these run against a database other tests share. Truncated
    // because level is varchar(32) and a whole UUID does not fit.
    course.setLevel("PACING-" + UUID.randomUUID().toString().substring(0, 8));
    course.setDescription("A second free deck, for the shared-intake test.");
    course.setPremium(false);
    course.setSortOrder(99);
    course = courseRepository.save(course);

    for (int i = 1; i <= cardCount; i++) {
      Card card = new Card();
      card.setCourse(course);
      card.setFrontText("テスト" + i);
      card.setBackText("てすと · test " + i);
      card.setCardType(CardType.VOCAB);
      card.setSortOrder(i);
      cardRepository.save(card);
    }

    return course;
  }
}
