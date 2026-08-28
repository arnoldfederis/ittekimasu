package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.ittekimasu.server.entity.Card;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.entity.UserCardProgress;
import app.ittekimasu.server.repository.CardRepository;
import app.ittekimasu.server.repository.CourseRepository;
import app.ittekimasu.server.repository.UserCardProgressRepository;
import app.ittekimasu.server.repository.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Does this learner have anything to do?" — the question behind both the streak rule and
 * whether the daily reminder is worth sending.
 *
 * <p>An integration test rather than a unit one because the risk is in the QUERIES: both take
 * the accessible-deck set as a collection parameter, which parses at bootstrap but only
 * proves itself when it executes.
 *
 * <p>Needs Postgres running (`devbox run dev up`).
 */
@SpringBootTest
@Transactional
class ReviewServiceWorkAvailableIntegrationTest {

  @Autowired private ReviewService reviewService;
  @Autowired private UserRepository userRepository;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CardRepository cardRepository;
  @Autowired private UserCardProgressRepository progressRepository;

  private User user;

  @BeforeEach
  void setUp() {
    user = new User();
    user.setFirebaseUid("work-available-test-" + UUID.randomUUID());
    user.setEmail("work-available-test@ittekimasu.app");
    user = userRepository.save(user);
  }

  /** Every seeded card is unseen for a brand new account, so there is always work. */
  @Test
  void aNewUserHasWorkBecauseEveryCardIsUnseen() {
    assertThat(reviewService.hasWorkAvailable(user.getId())).isTrue();
  }

  /**
   * The caught-up learner: every free card answered and scheduled ahead. This is the state
   * that used to break the streak and still fire a reminder.
   */
  @Test
  void aUserWhoHasScheduledEveryFreeCardAheadHasNoWork() {
    scheduleEveryFreeCard(LocalDate.now(ReviewService.APP_ZONE).plusDays(6));

    assertThat(reviewService.hasWorkAvailable(user.getId())).isFalse();
  }

  /** A card that has come round again is work, however far ahead the rest are scheduled. */
  @Test
  void oneCardDueTodayIsEnoughToBeWorthReminding() {
    LocalDate today = LocalDate.now(ReviewService.APP_ZONE);
    List<UserCardProgress> scheduled = scheduleEveryFreeCard(today.plusDays(6));

    // One of THIS user's rows. The database is shared with whatever else is in dev, so
    // reaching for progressRepository.findAll() would pull down a stranger's card.
    UserCardProgress first = scheduled.getFirst();
    first.setNextReviewDate(today);
    progressRepository.save(first);

    assertThat(reviewService.hasWorkAvailable(user.getId())).isTrue();
  }

  /** Gives this user a progress row for every card in every FREE deck. */
  private List<UserCardProgress> scheduleEveryFreeCard(LocalDate nextReview) {
    List<Card> freeCards =
        courseRepository.findAll().stream()
            .filter(course -> !course.isPremium())
            .flatMap(
                course ->
                    cardRepository.findAllByCourseIdOrderBySortOrderAsc(course.getId()).stream())
            .toList();

    // A deck with no cards would make this test pass for the wrong reason.
    assertThat(freeCards).isNotEmpty();

    return freeCards.stream()
        .map(
            card -> {
              UserCardProgress progress = new UserCardProgress();
              progress.setUser(user);
              progress.setCard(card);
              progress.setEaseFactor(2.5);
              progress.setIntervalDays(6);
              progress.setStreakCount(1);
              progress.setNextReviewDate(nextReview);
              progress.setLastReviewedAt(Instant.now());
              return progressRepository.save(progress);
            })
        .toList();
  }
}
