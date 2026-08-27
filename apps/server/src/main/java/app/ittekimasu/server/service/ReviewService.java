package app.ittekimasu.server.service;

import app.ittekimasu.server.dto.response.CardDueResponse;
import app.ittekimasu.server.dto.response.DueCardsResponse;
import app.ittekimasu.server.dto.response.IntervalPreviewResponse;
import app.ittekimasu.server.dto.response.ReviewResultResponse;
import app.ittekimasu.server.entity.Card;
import app.ittekimasu.server.entity.Course;
import app.ittekimasu.server.entity.ReviewRating;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.entity.UserCardProgress;
import app.ittekimasu.server.exception.PaymentRequiredException;
import app.ittekimasu.server.exception.ResourceNotFoundException;
import app.ittekimasu.server.repository.CardRepository;
import app.ittekimasu.server.repository.CourseRepository;
import app.ittekimasu.server.repository.UserCardProgressRepository;
import app.ittekimasu.server.repository.UserRepository;
import app.ittekimasu.server.service.SpacedRepetitionService.Schedule;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Everything around the algorithm: who may review, what is due, and what to persist. */
@Service
public class ReviewService {

  /** Free tier. Premium has no daily cap; the check stays server-side either way. */
  public static final int FREE_DAILY_REVIEW_LIMIT = 20;

  /** How many cards a premium session hands over at once. Not a cap, just a sitting. */
  static final int PREMIUM_SESSION_SIZE = 50;

  /**
   * One day boundary for the whole app rather than a per-user timezone. Everyone here is
   * either in Japan or moving there, and a per-user zone is a settings screen, not an MVP.
   */
  static final ZoneId APP_ZONE = ZoneId.of("Asia/Tokyo");

  private final CourseRepository courseRepository;
  private final CardRepository cardRepository;
  private final UserCardProgressRepository progressRepository;
  private final UserRepository userRepository;
  private final SpacedRepetitionService scheduler;
  private final EntitlementService entitlementService;

  public ReviewService(
      CourseRepository courseRepository,
      CardRepository cardRepository,
      UserCardProgressRepository progressRepository,
      UserRepository userRepository,
      SpacedRepetitionService scheduler,
      EntitlementService entitlementService) {
    this.courseRepository = courseRepository;
    this.cardRepository = cardRepository;
    this.progressRepository = progressRepository;
    this.userRepository = userRepository;
    this.scheduler = scheduler;
    this.entitlementService = entitlementService;
  }

  @Transactional(readOnly = true)
  public DueCardsResponse listDue(UUID userId, UUID courseId) {
    Course course =
        courseRepository
            .findById(courseId)
            .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));

    boolean premium = entitlementService.isPremium(userId);
    requireAccess(course, premium);

    LocalDate today = LocalDate.now(APP_ZONE);
    int reviewedToday = reviewedToday(userId, today);
    Integer remaining = remainingReviews(reviewedToday, premium);

    // Premium is unlimited per day, but a session still needs a bound: handing back 500 cards
    // is not a session, it is a wall.
    int sessionSize = remaining == null ? PREMIUM_SESSION_SIZE : remaining;

    // Asking for zero rows is a wasted query, and PageRequest rejects a size of 0 anyway.
    List<Card> due =
        sessionSize == 0
            ? List.of()
            : cardRepository.findDueCards(userId, courseId, today, PageRequest.of(0, sessionSize));

    Map<UUID, UserCardProgress> progressByCard = progressFor(userId, due);

    List<CardDueResponse> cards =
        due.stream()
            .map(card -> toDueResponse(card, progressByCard.get(card.getId())))
            .toList();

    return new DueCardsResponse(
        course.getId(),
        course.getTitle(),
        cards,
        progressRepository.countByUserIdAndCardCourseId(userId, courseId),
        cardRepository.countByCourseId(courseId),
        reviewedToday,
        premium ? null : FREE_DAILY_REVIEW_LIMIT,
        remaining,
        managedUser(userId).getCurrentStreakDays());
  }

  @Transactional
  public ReviewResultResponse submitReview(UUID userId, UUID cardId, ReviewRating rating) {
    Card card =
        cardRepository
            .findById(cardId)
            .orElseThrow(() -> new ResourceNotFoundException("Card", cardId));

    boolean premium = entitlementService.isPremium(userId);
    requireAccess(card.getCourse(), premium);

    User user = managedUser(userId);
    LocalDate today = LocalDate.now(APP_ZONE);
    Instant now = Instant.now();

    UserCardProgress progress =
        progressRepository.findByUserIdAndCardId(userId, cardId).orElse(null);

    // Re-rating a card already answered today costs nothing extra — the cap counts distinct
    // cards, so a learner correcting a mis-tap is not punished for it.
    boolean alreadyCountedToday =
        progress != null && !progress.getLastReviewedAt().isBefore(startOfDay(today));

    Integer remaining = remainingReviews(reviewedToday(userId, today), premium);
    if (!alreadyCountedToday && remaining != null && remaining == 0) {
      throw new PaymentRequiredException(
          "That's %d reviews today — the free daily limit. Come back tomorrow, or go unlimited with premium."
              .formatted(FREE_DAILY_REVIEW_LIMIT));
    }

    Schedule next = scheduler.processReview(Schedule.of(progress), rating);

    if (progress == null) {
      progress = new UserCardProgress();
      progress.setUser(user);
      progress.setCard(card);
    }
    progress.setEaseFactor(next.easeFactor());
    progress.setIntervalDays(next.intervalDays());
    progress.setStreakCount(next.streakCount());
    progress.setNextReviewDate(today.plusDays(next.intervalDays()));
    progress.setLastReviewedAt(now);
    progressRepository.save(progress);

    recordStudyDay(user, today);

    int reviewedAfterSave = reviewedToday(userId, today);

    return new ReviewResultResponse(
        cardId,
        rating.name(),
        next.intervalDays(),
        progress.getNextReviewDate(),
        next.easeFactor(),
        next.streakCount(),
        user.getCurrentStreakDays(),
        user.getLongestStreakDays(),
        // The save above may have consumed a slot, so count again rather than subtracting.
        reviewedAfterSave,
        remainingReviews(reviewedAfterSave, premium));
  }

  /**
   * Extends the day streak at most once per day. A gap of two or more days restarts at 1
   * rather than zeroing — the learner did study today, and the streak card should say so.
   */
  private void recordStudyDay(User user, LocalDate today) {
    LocalDate last = user.getLastStudiedOn();
    if (today.equals(last)) {
      return;
    }

    user.setCurrentStreakDays(today.minusDays(1).equals(last) ? user.getCurrentStreakDays() + 1 : 1);
    user.setLastStudiedOn(today);
    user.setLongestStreakDays(Math.max(user.getLongestStreakDays(), user.getCurrentStreakDays()));
  }

  /** Distinct cards touched since the start of the app-timezone day. */
  private int reviewedToday(UUID userId, LocalDate today) {
    return progressRepository.countByUserIdAndLastReviewedAtGreaterThanEqual(
        userId, startOfDay(today));
  }

  /** Null means unlimited — premium has no daily cap to count down from. */
  private Integer remainingReviews(int reviewedToday, boolean premium) {
    return premium ? null : Math.max(0, FREE_DAILY_REVIEW_LIMIT - reviewedToday);
  }

  /**
   * Premium is decided from the database via EntitlementService, never from a flag the client
   * sends. The mobile app knows its own entitlement from the RevenueCat SDK, but that is for
   * rendering — this is the gate.
   */
  private void requireAccess(Course course, boolean premium) {
    if (course.isPremium() && !premium) {
      throw new PaymentRequiredException("%s is a premium deck.".formatted(course.getTitle()));
    }
  }

  private Map<UUID, UserCardProgress> progressFor(UUID userId, List<Card> cards) {
    if (cards.isEmpty()) {
      return Map.of();
    }
    List<UUID> ids = cards.stream().map(Card::getId).toList();
    return progressRepository.findAllByUserIdAndCardIdIn(userId, ids).stream()
        .collect(
            Collectors.toMap(
                p -> p.getCard().getId(), Function.identity(), (a, b) -> a, HashMap::new));
  }

  private CardDueResponse toDueResponse(Card card, UserCardProgress progress) {
    Schedule current = Schedule.of(progress);
    return new CardDueResponse(
        card.getId(),
        card.getFrontText(),
        card.getBackText(),
        card.getCardType().name(),
        progress != null,
        new IntervalPreviewResponse(
            scheduler.projectInterval(current, ReviewRating.AGAIN),
            scheduler.projectInterval(current, ReviewRating.HARD),
            scheduler.projectInterval(current, ReviewRating.GOOD),
            scheduler.projectInterval(current, ReviewRating.EASY)));
  }

  /**
   * Loads the user inside this transaction. UserService.findOrCreate hands back a DETACHED
   * entity, so streak changes made on it would silently never flush.
   */
  private User managedUser(UUID userId) {
    return userRepository
        .findById(userId)
        .orElseThrow(() -> new ResourceNotFoundException("User", userId));
  }

  private Instant startOfDay(LocalDate day) {
    return day.atStartOfDay(APP_ZONE).toInstant();
  }
}
