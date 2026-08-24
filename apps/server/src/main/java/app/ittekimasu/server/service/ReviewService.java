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

  /** Free tier. Premium lifts this in step 6; the check stays server-side either way. */
  public static final int FREE_DAILY_REVIEW_LIMIT = 20;

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

  public ReviewService(
      CourseRepository courseRepository,
      CardRepository cardRepository,
      UserCardProgressRepository progressRepository,
      UserRepository userRepository,
      SpacedRepetitionService scheduler) {
    this.courseRepository = courseRepository;
    this.cardRepository = cardRepository;
    this.progressRepository = progressRepository;
    this.userRepository = userRepository;
    this.scheduler = scheduler;
  }

  @Transactional(readOnly = true)
  public DueCardsResponse listDue(UUID userId, UUID courseId) {
    Course course =
        courseRepository
            .findById(courseId)
            .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
    requireAccess(course);

    LocalDate today = LocalDate.now(APP_ZONE);
    int remaining = remainingReviews(userId, today);

    // Asking for zero rows is a wasted query, and PageRequest rejects a size of 0 anyway.
    List<Card> due =
        remaining == 0
            ? List.of()
            : cardRepository.findDueCards(userId, courseId, today, PageRequest.of(0, remaining));

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
        FREE_DAILY_REVIEW_LIMIT,
        remaining,
        managedUser(userId).getCurrentStreakDays());
  }

  @Transactional
  public ReviewResultResponse submitReview(UUID userId, UUID cardId, ReviewRating rating) {
    Card card =
        cardRepository
            .findById(cardId)
            .orElseThrow(() -> new ResourceNotFoundException("Card", cardId));
    requireAccess(card.getCourse());

    User user = managedUser(userId);
    LocalDate today = LocalDate.now(APP_ZONE);
    Instant now = Instant.now();

    UserCardProgress progress =
        progressRepository.findByUserIdAndCardId(userId, cardId).orElse(null);

    // Re-rating a card already answered today costs nothing extra — the cap counts distinct
    // cards, so a learner correcting a mis-tap is not punished for it.
    boolean alreadyCountedToday =
        progress != null && !progress.getLastReviewedAt().isBefore(startOfDay(today));

    if (!alreadyCountedToday && remainingReviews(userId, today) == 0) {
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
        remainingReviews(userId, today));
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

  private int remainingReviews(UUID userId, LocalDate today) {
    int reviewedToday =
        progressRepository.countByUserIdAndLastReviewedAtGreaterThanEqual(
            userId, startOfDay(today));
    return Math.max(0, FREE_DAILY_REVIEW_LIMIT - reviewedToday);
  }

  /**
   * Premium is decided here, from the database, never from a flag the client sends. Until the
   * Entitlement table lands in step 6 every account is free, so a locked deck is a hard 402.
   */
  private void requireAccess(Course course) {
    if (course.isPremium()) {
      throw new PaymentRequiredException(
          "%s is a premium deck.".formatted(course.getTitle()));
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
