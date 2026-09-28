package app.ittekimasu.server.service;

import app.ittekimasu.server.dto.response.CardDueResponse;
import app.ittekimasu.server.dto.response.DueCardsResponse;
import app.ittekimasu.server.dto.response.IntervalPreviewResponse;
import app.ittekimasu.server.dto.response.ReviewResultResponse;
import app.ittekimasu.server.dto.response.SeenCardResponse;
import app.ittekimasu.server.dto.response.StudyDayResponse;
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
import app.ittekimasu.server.repository.UserKanaProgressRepository;
import app.ittekimasu.server.repository.UserRepository;
import app.ittekimasu.server.repository.UserStudyDayRepository;
import app.ittekimasu.server.service.SpacedRepetitionService.Schedule;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
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
   * How many cards a learner meets for the FIRST time in one day, PER DECK.
   *
   * <p>Not a paywall — premium is bound by it too. It is pacing, and it exists for two
   * reasons. A hundred unfamiliar characters in one sitting is how cramming works and
   * cramming does not stick; and without it a deck can be exhausted in an afternoon, leaving
   * the app with nothing to offer for the six days SM-2 then imposes.
   *
   * <p>Per deck rather than across all of them, which is what it used to be. Shared, a
   * subscriber who had just unlocked three decks got the same ten cards a day as before and
   * could not tell what they had paid for — the pacing was silently doing the job of a
   * paywall. Ten per deck keeps a single deck at exactly the pace it always had (a free user
   * has one deck, so nothing changes for them) while letting someone who owns four decks
   * actually start more than one of them.
   *
   * <p>Reviews are untouched: everything due still comes back the moment it is due.
   */
  static final int NEW_CARDS_PER_DECK_PER_DAY = 10;

  /**
   * The ceiling across every deck, so "ten per deck" cannot become forty new cards in an
   * evening. Three decks' worth is already more first-time material than a sitting can hold.
   */
  static final int NEW_CARDS_PER_DAY_TOTAL = 30;

  /**
   * One day boundary for the whole app rather than a per-user timezone. Everyone here is
   * either in Japan or moving there, and a per-user zone is a settings screen, not an MVP.
   */
  static final ZoneId APP_ZONE = ZoneId.of("Asia/Tokyo");

  private final CourseRepository courseRepository;
  private final CardRepository cardRepository;
  private final UserCardProgressRepository progressRepository;
  private final UserRepository userRepository;
  private final UserStudyDayRepository studyDayRepository;
  private final UserKanaProgressRepository kanaProgressRepository;
  private final SpacedRepetitionService scheduler;
  private final EntitlementService entitlementService;

  public ReviewService(
      CourseRepository courseRepository,
      CardRepository cardRepository,
      UserCardProgressRepository progressRepository,
      UserRepository userRepository,
      UserStudyDayRepository studyDayRepository,
      UserKanaProgressRepository kanaProgressRepository,
      SpacedRepetitionService scheduler,
      EntitlementService entitlementService) {
    this.courseRepository = courseRepository;
    this.cardRepository = cardRepository;
    this.progressRepository = progressRepository;
    this.userRepository = userRepository;
    this.studyDayRepository = studyDayRepository;
    this.kanaProgressRepository = kanaProgressRepository;
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
            : cardRepository.findDueSeenCards(
                userId, courseId, today, PageRequest.of(0, sessionSize));

    /*
     * New cards fill whatever the due backlog left, up to the day's intake. Due FIRST and
     * unconditionally: material already half-learned is worth more than material never seen,
     * and burying a backlog under new words is how a deck becomes unmanageable.
     */
    int newRemaining = newCardsRemainingToday(userId, courseId, today);
    int newSlots = Math.min(sessionSize - due.size(), newRemaining);
    List<Card> unseen =
        newSlots <= 0
            ? List.of()
            : cardRepository.findUnseenInCourse(userId, courseId, PageRequest.of(0, newSlots));

    List<Card> session = Stream.concat(due.stream(), unseen.stream()).toList();
    Map<UUID, UserCardProgress> progressByCard = progressFor(userId, session);

    List<CardDueResponse> cards =
        session.stream()
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
        managedUser(userId).getCurrentStreakDays(),
        progressRepository.findEarliestNextReviewDateForCourse(userId, courseId),
        newRemaining,
        cardRepository.countUnseenInCourse(userId, courseId));
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

    // Read before the save below reschedules this card and hides whether it was overdue.
    boolean gapWasEmpty = studyGapWasEmpty(userId, user.getLastStudiedOn(), today, premium);

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
    } else {
      // Only for a card that already had state. A first review leaves the snapshot null,
      // which is how undo knows to delete the row rather than restore it.
      progress.setPreviousEaseFactor(progress.getEaseFactor());
      progress.setPreviousIntervalDays(progress.getIntervalDays());
      progress.setPreviousStreakCount(progress.getStreakCount());
      progress.setPreviousNextReviewDate(progress.getNextReviewDate());
      progress.setPreviousLastReviewedAt(progress.getLastReviewedAt());
    }
    progress.setLastRating(rating);
    progress.setEaseFactor(next.easeFactor());
    progress.setIntervalDays(next.intervalDays());
    progress.setStreakCount(next.streakCount());
    progress.setNextReviewDate(today.plusDays(next.intervalDays()));
    progress.setLastReviewedAt(now);
    progressRepository.save(progress);

    recordStudyDay(user, today, gapWasEmpty);
    // Every review, not just the first of the day: the count is what shades the grid.
    studyDayRepository.recordReview(userId, today);

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
   * The streak after studying on {@code today}. Pure and clock-free so the awkward cases are
   * testable without a database.
   *
   * <p>{@code gapWasEmpty} is what stops the algorithm punishing its own success: a first
   * non-AGAIN answer schedules a card six days out, so a learner who clears a deck is given
   * nothing to do for most of a week and used to come back to a streak of 1. A day with
   * nothing due is not a day they skipped.
   */
  static int nextStreak(int current, LocalDate last, LocalDate today, boolean gapWasEmpty) {
    if (last == null) {
      return 1;
    }
    boolean unbroken = today.minusDays(1).equals(last) || gapWasEmpty;
    // Restarts at 1, never 0 — the learner did study today and the card should say so.
    return unbroken ? current + 1 : 1;
  }

  /**
   * Whether the days between the last study day and today held nothing to review.
   *
   * <p>Read BEFORE the review is saved. Saving reschedules the card being answered, which
   * erases the evidence that it was overdue — and an overdue card is precisely a day the
   * learner did skip.
   */
  private boolean studyGapWasEmpty(UUID userId, LocalDate last, LocalDate today, boolean premium) {
    // No gap to judge: yesterday, today, or a streak that has not started.
    if (last == null || !last.isBefore(today.minusDays(1))) {
      return true;
    }

    Collection<Boolean> accessible = premium ? List.of(false, true) : List.of(false);

    // An unseen card was available every one of those days.
    if (cardRepository.countUnseen(userId, accessible) > 0) {
      return false;
    }

    LocalDate earliestDue = progressRepository.findEarliestNextReviewDate(userId, accessible);
    // Due yesterday or earlier means there was a day with work on it. Due today is fine —
    // that is the card being answered right now.
    return earliestDue == null || !earliestDue.isBefore(today);
  }

  /** Extends the day streak at most once per day. */
  private void recordStudyDay(User user, LocalDate today, boolean gapWasEmpty) {
    LocalDate last = user.getLastStudiedOn();
    if (today.equals(last)) {
      return;
    }

    user.setCurrentStreakDays(
        nextStreak(user.getCurrentStreakDays(), last, today, gapWasEmpty));
    user.setLastStudiedOn(today);
    user.setLongestStreakDays(Math.max(user.getLongestStreakDays(), user.getCurrentStreakDays()));
  }

  /**
   * Takes back the most recent answer for one card.
   *
   * <p>Restores the schedule the card had before it, or deletes the progress row entirely
   * when the answer being undone was the card's first — a card reviewed once and undone must
   * go back to being unseen, not to a "reviewed" row with invented numbers.
   *
   * <p>The day streak and the study-day count are deliberately left alone. The learner did
   * study today; a mis-tap is not a reason to take that away, and the alternative is undoing
   * a streak they may have earned with other cards in the same session.
   */
  @Transactional
  public void undoReview(UUID userId, UUID cardId) {
    UserCardProgress progress =
        progressRepository
            .findByUserIdAndCardId(userId, cardId)
            .orElseThrow(() -> new ResourceNotFoundException("Review", cardId));

    if (progress.getPreviousLastReviewedAt() == null) {
      // First-ever review of this card: undoing it means the card was never seen.
      progressRepository.delete(progress);
      return;
    }

    progress.setEaseFactor(progress.getPreviousEaseFactor());
    progress.setIntervalDays(progress.getPreviousIntervalDays());
    progress.setStreakCount(progress.getPreviousStreakCount());
    progress.setNextReviewDate(progress.getPreviousNextReviewDate());
    progress.setLastReviewedAt(progress.getPreviousLastReviewedAt());

    // One step only: the snapshot is spent, and a second undo must not walk further back
    // into state this row no longer has.
    progress.setLastRating(null);
    progress.setPreviousEaseFactor(null);
    progress.setPreviousIntervalDays(null);
    progress.setPreviousStreakCount(null);
    progress.setPreviousNextReviewDate(null);
    progress.setPreviousLastReviewedAt(null);
  }

  /** Every card the learner has answered, for the seen-cards browser. */
  @Transactional(readOnly = true)
  public List<SeenCardResponse> listSeenCards(UUID userId) {
    return progressRepository.findAllSeenWithCard(userId).stream()
        .map(progress -> SeenCardResponse.from(progress, intervalsFor(correctionBaseline(progress))))
        .toList();
  }

  /**
   * The state a correction is measured from: where the card stood BEFORE its most recent
   * answer.
   *
   * <p>This is what makes changing a difficulty in the browser idempotent. Applying SM-2 to
   * the CURRENT state compounds — tapping Easy three times took a card from 6 days to 21 to
   * 76 to 289, because each tap multiplied the interval the previous tap had just produced.
   * A browser is not a review session; "I meant to press Hard" must land on the same schedule
   * however many times it is pressed.
   *
   * <p>Three cases, and the middle one is easy to miss:
   *
   * <ul>
   *   <li>A snapshot exists — the card has been answered more than once, so rewind to it.
   *   <li>No snapshot but a recorded rating — the card's ONLY answer was its first, so the
   *       baseline is an unseen card. Falling through to the current state here is what kept
   *       corrections compounding after the fix to the general case.
   *   <li>Neither — a row written before V15 recorded any of this. The current state is the
   *       best available answer rather than a right one, and one real review fixes it.
   * </ul>
   */
  private Schedule correctionBaseline(UserCardProgress progress) {
    if (progress.getPreviousLastReviewedAt() != null) {
      return new Schedule(
          progress.getPreviousEaseFactor(),
          progress.getPreviousIntervalDays(),
          progress.getPreviousStreakCount());
    }
    if (progress.getLastRating() != null) {
      return Schedule.newCard();
    }
    return Schedule.of(progress);
  }

  /**
   * Changes the answer already given for one card, rather than answering it again.
   *
   * <p>Not a review: no daily allowance spent, no streak moved, no study day recorded. The
   * card was counted when it was actually answered, and correcting a mis-tap minutes later
   * is not a second act of study.
   *
   * <p>The undo snapshot is deliberately NOT rewritten, so a second correction starts from
   * the same place as the first.
   */
  @Transactional
  public SeenCardResponse correctRating(UUID userId, UUID cardId, ReviewRating rating) {
    UserCardProgress progress =
        progressRepository
            .findByUserIdAndCardId(userId, cardId)
            .orElseThrow(() -> new ResourceNotFoundException("Review", cardId));

    applyCorrection(progress, rating, LocalDate.now(APP_ZONE), Instant.now());
    return SeenCardResponse.from(progress, intervalsFor(correctionBaseline(progress)));
  }

  /** Shared by the single correction and the bulk one, so the two can never drift. */
  private void applyCorrection(
      UserCardProgress progress, ReviewRating rating, LocalDate today, Instant now) {
    Schedule next = scheduler.processReview(correctionBaseline(progress), rating);

    progress.setLastRating(rating);
    progress.setEaseFactor(next.easeFactor());
    progress.setIntervalDays(next.intervalDays());
    progress.setStreakCount(next.streakCount());
    progress.setNextReviewDate(today.plusDays(next.intervalDays()));
    progress.setLastReviewedAt(now);
  }

  /**
   * Re-rates every seen card, optionally within one deck.
   *
   * <p>Deliberately NOT counted as reviews: the daily cap is untouched, the streak does not
   * move, and no study day is recorded. Marking a hundred cards at once is deck maintenance —
   * "I have forgotten this whole deck, start it over" — and treating it as a hundred reviews
   * would spend a free learner's allowance for a week and inflate the grid with a day of
   * study that never happened.
   *
   * <p>Idempotent, like the single-card correction: each card is measured from where it
   * stood before its last answer, so pressing "set all to Easy" twice does not multiply every
   * interval twice. Each card keeps its undo snapshot, so one can still be put back.
   *
   * @return how many cards were rescheduled.
   */
  @Transactional
  public int rateAllSeen(UUID userId, UUID courseId, ReviewRating rating) {
    LocalDate today = LocalDate.now(APP_ZONE);
    Instant now = Instant.now();

    List<UserCardProgress> rows =
        progressRepository.findAllSeenWithCard(userId).stream()
            .filter(row -> courseId == null || row.getCard().getCourse().getId().equals(courseId))
            .toList();

    for (UserCardProgress progress : rows) {
      applyCorrection(progress, rating, today, now);
    }

    return rows.size();
  }

  /**
   * Forgets every seen card, optionally within one deck: the whole lot goes back to unseen.
   *
   * @return how many cards were forgotten.
   */
  @Transactional
  public int forgetAllSeen(UUID userId, UUID courseId) {
    List<UserCardProgress> rows =
        progressRepository.findAllSeenWithCard(userId).stream()
            .filter(row -> courseId == null || row.getCard().getCourse().getId().equals(courseId))
            .toList();

    progressRepository.deleteAll(rows);
    return rows.size();
  }

  /**
   * Forgets a card completely: the progress row goes, and the card returns to the unseen
   * pile to be taught again from scratch.
   *
   * <p>Distinct from undo, which rewinds ONE answer. This is "I never learned this", and it
   * is the only honest way to fix a card marked Easy months ago and long since forgotten.
   */
  @Transactional
  public void forgetCard(UUID userId, UUID cardId) {
    progressRepository
        .findByUserIdAndCardId(userId, cardId)
        .ifPresent(progressRepository::delete);
  }

  /**
   * Starts the learner over completely: every card unseen, the streak back to zero, the
   * study grid empty.
   *
   * <p>The deliberate opposite of forgetting one deck's cards, which leaves the streak and
   * the grid alone because those record days the learner actually turned up and deleting a
   * deck's scheduling does not un-happen them. This is the action where erasing that history
   * IS the request, so it goes too — anything less would leave a profile claiming a
   * twelve-day habit next to zero cards learned.
   *
   * <p>The kana quiz's Pro backup goes too, in the same transaction. It is not SRS progress,
   * but it is progress, and a restore on the next launch would otherwise put the streak marks
   * straight back onto a chart the learner just asked to start over. (The device clears its
   * own copy when this succeeds.)
   *
   * @return how many cards were forgotten.
   */
  @Transactional
  public int resetAllProgress(UUID userId) {
    User user = managedUser(userId);
    int affected = progressRepository.findAllSeenWithCard(userId).size();

    progressRepository.deleteAllByUserId(userId);
    studyDayRepository.deleteAllByUserId(userId);
    kanaProgressRepository.deleteAllByUserId(userId);

    user.setCurrentStreakDays(0);
    user.setLongestStreakDays(0);
    user.setLastStudiedOn(null);

    return affected;
  }

  /** The study grid: the days this user reviewed something, oldest first. */
  @Transactional(readOnly = true)
  public List<StudyDayResponse> listStudyDays(UUID userId, int days) {
    LocalDate from = LocalDate.now(APP_ZONE).minusDays(days - 1L);
    return studyDayRepository
        .findAllByUserIdAndStudiedOnGreaterThanEqualOrderByStudiedOnAsc(userId, from)
        .stream()
        .map(StudyDayResponse::from)
        .toList();
  }

  /**
   * Whether the user has anything to review right now, in any deck they can open.
   *
   * <p>Used by the daily reminder: nudging someone whose every card is scheduled days ahead
   * teaches them the notification is noise, which costs far more than the one push gains.
   */
  @Transactional(readOnly = true)
  public boolean hasWorkAvailable(UUID userId) {
    boolean premium = entitlementService.isPremium(userId);
    Collection<Boolean> accessible = premium ? List.of(false, true) : List.of(false);
    LocalDate today = LocalDate.now(APP_ZONE);

    // Unseen cards are only work if the day's intake still has room. Otherwise the app would
    // nudge someone towards cards it has already decided not to hand over until tomorrow.
    if (anyNewCardsRemainingToday(userId, today)
        && cardRepository.countUnseen(userId, accessible) > 0) {
      return true;
    }

    LocalDate earliestDue = progressRepository.findEarliestNextReviewDate(userId, accessible);
    return earliestDue != null && !earliestDue.isAfter(today);
  }

  /** Distinct cards touched since the start of the app-timezone day. */
  private int reviewedToday(UUID userId, LocalDate today) {
    return progressRepository.countByUserIdAndLastReviewedAtGreaterThanEqual(
        userId, startOfDay(today));
  }

  /**
   * How many first-time cards are left in today's intake for ONE deck — whichever of the two
   * limits bites first, the deck's ten or the day's thirty.
   *
   * <p>A progress row is created the first time a card is answered, so counting rows created
   * today counts exactly the cards introduced today — no extra column, and nothing to keep
   * in step.
   */
  private int newCardsRemainingToday(UUID userId, UUID courseId, LocalDate today) {
    Instant since = startOfDay(today);
    int inDeck =
        progressRepository.countByUserIdAndCardCourseIdAndCreatedAtGreaterThanEqual(
            userId, courseId, since);
    int everywhere = progressRepository.countByUserIdAndCreatedAtGreaterThanEqual(userId, since);

    return Math.max(
        0,
        Math.min(
            NEW_CARDS_PER_DECK_PER_DAY - inDeck, NEW_CARDS_PER_DAY_TOTAL - everywhere));
  }

  /**
   * Whether ANY accessible deck still has room in today's intake. Only the day-wide ceiling
   * can answer that without naming a deck, which is enough for the reminder: if the ceiling
   * is spent, no deck has room either.
   */
  private boolean anyNewCardsRemainingToday(UUID userId, LocalDate today) {
    int everywhere =
        progressRepository.countByUserIdAndCreatedAtGreaterThanEqual(userId, startOfDay(today));
    return everywhere < NEW_CARDS_PER_DAY_TOTAL;
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
    return new CardDueResponse(
        card.getId(),
        card.getFrontText(),
        card.getBackText(),
        card.getCardType().name(),
        progress != null,
        intervalsFor(Schedule.of(progress)));
  }

  /** What each button would schedule from a given state. Computed here and only here. */
  private IntervalPreviewResponse intervalsFor(Schedule current) {
    return new IntervalPreviewResponse(
        scheduler.projectInterval(current, ReviewRating.AGAIN),
        scheduler.projectInterval(current, ReviewRating.HARD),
        scheduler.projectInterval(current, ReviewRating.GOOD),
        scheduler.projectInterval(current, ReviewRating.EASY));
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
