package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.request.BulkRatingRequest;
import app.ittekimasu.server.dto.request.CorrectRatingRequest;
import app.ittekimasu.server.dto.request.UpdateRemindersRequest;
import app.ittekimasu.server.dto.response.EntitlementResponse;
import app.ittekimasu.server.dto.response.BulkCardsResponse;
import app.ittekimasu.server.dto.response.SeenCardResponse;
import app.ittekimasu.server.dto.response.StudyDayResponse;
import app.ittekimasu.server.dto.response.UserResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.EntitlementService;
import app.ittekimasu.server.service.ReviewService;
import app.ittekimasu.server.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {

  /** Twenty weeks — as much history as fits across a phone at a legible square size. */
  private static final int STUDY_GRID_DAYS = 140;

  private final UserService userService;
  private final EntitlementService entitlementService;
  private final ReviewService reviewService;

  public UserController(
      UserService userService,
      EntitlementService entitlementService,
      ReviewService reviewService) {
    this.userService = userService;
    this.entitlementService = entitlementService;
    this.reviewService = reviewService;
  }

  @GetMapping("/me")
  public UserResponse me(@AuthenticationPrincipal FirebasePrincipal principal) {
    return UserResponse.from(userService.findOrCreate(principal));
  }

  /** Sets or clears the daily reminder. A null hour switches it off. */
  @PatchMapping("/me/reminders")
  public UserResponse updateReminders(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @Valid @RequestBody UpdateRemindersRequest request) {
    return UserResponse.from(
        userService.updateReminders(
            userService.findOrCreate(principal).getId(),
            request.reminderHour(),
            request.reminderTimezone()));
  }

  /**
   * Finishes onboarding for someone who does not want a checklist.
   *
   * <p>Adopting a template does this too (see ChecklistService), so this endpoint exists only
   * for the study-only path. Without it that user has nothing on the server saying they are
   * done, and the app has no choice but to show them onboarding again on every launch.
   */
  @PostMapping("/me/onboarding")
  public UserResponse completeOnboarding(@AuthenticationPrincipal FirebasePrincipal principal) {
    return UserResponse.from(
        userService.completeOnboarding(userService.findOrCreate(principal).getId()));
  }

  /**
   * The authoritative answer to "am I premium". The RevenueCat SDK gives the app the same
   * answer locally, but only this one gates anything.
   */
  @GetMapping("/me/entitlement")
  public EntitlementResponse entitlement(@AuthenticationPrincipal FirebasePrincipal principal) {
    return entitlementService.getEntitlement(
        userService.findOrCreate(principal).getId(), ReviewService.FREE_DAILY_REVIEW_LIMIT);
  }

  /**
   * The last {@value #STUDY_GRID_DAYS} days the user studied, for the profile grid.
   *
   * <p>Only the days they DID study come back; the client knows the window and fills the
   * gaps, so an empty grid costs one empty array rather than 120 zeroes.
   */
  @GetMapping("/me/study-days")
  public List<StudyDayResponse> studyDays(@AuthenticationPrincipal FirebasePrincipal principal) {
    return reviewService.listStudyDays(
        userService.findOrCreate(principal).getId(), STUDY_GRID_DAYS);
  }

  /** Every card this user has answered, with where each one currently stands. */
  @GetMapping("/me/cards")
  public List<SeenCardResponse> seenCards(@AuthenticationPrincipal FirebasePrincipal principal) {
    return reviewService.listSeenCards(userService.findOrCreate(principal).getId());
  }

  /**
   * Changes the answer already recorded for one card.
   *
   * <p>A correction, not a review: it spends no daily allowance and moves no streak, and it
   * is measured from where the card stood before its last answer so pressing the same button
   * twice lands on the same schedule.
   */
  @PatchMapping("/me/cards/{cardId}")
  public SeenCardResponse correctRating(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @PathVariable UUID cardId,
      @Valid @RequestBody CorrectRatingRequest request) {
    return reviewService.correctRating(
        userService.findOrCreate(principal).getId(), cardId, request.rating());
  }

  /**
   * Forgets one card: it returns to the unseen pile and will be taught again.
   *
   * <p>Not the same as DELETE /reviews/{cardId}, which takes back a single answer. This
   * throws the whole history of the card away, which is what "remove from my seen cards"
   * has to mean if the card is ever to be learned properly again.
   */
  @DeleteMapping("/me/cards/{cardId}")
  public ResponseEntity<Void> forgetCard(
      @AuthenticationPrincipal FirebasePrincipal principal, @PathVariable UUID cardId) {
    reviewService.forgetCard(userService.findOrCreate(principal).getId(), cardId);
    return ResponseEntity.noContent().build();
  }

  /**
   * Re-rates every seen card, optionally within one deck.
   *
   * <p>Maintenance, not study: it spends no daily allowance and moves no streak. See
   * ReviewService.rateAllSeen for why.
   */
  @PatchMapping("/me/cards")
  public BulkCardsResponse rateAllCards(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @Valid @RequestBody BulkRatingRequest request) {
    return new BulkCardsResponse(
        reviewService.rateAllSeen(
            userService.findOrCreate(principal).getId(), request.courseId(), request.rating()));
  }

  /** Forgets every seen card, optionally within one deck. */
  @DeleteMapping("/me/cards")
  public BulkCardsResponse forgetAllCards(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @RequestParam(required = false) UUID courseId) {
    return new BulkCardsResponse(
        reviewService.forgetAllSeen(userService.findOrCreate(principal).getId(), courseId));
  }

  /**
   * Starts learning over: every card unseen, streak zeroed, study grid cleared.
   *
   * <p>Separate from DELETE /users/me/cards, which is deck maintenance and leaves the record
   * of days studied intact. Here, erasing that record is the point of the request.
   */
  @DeleteMapping("/me/progress")
  public BulkCardsResponse resetProgress(
      @AuthenticationPrincipal FirebasePrincipal principal) {
    return new BulkCardsResponse(
        reviewService.resetAllProgress(userService.findOrCreate(principal).getId()));
  }

  /**
   * Account deletion, required by App Store review guideline 5.1.1(v).
   *
   * <p>Two calls, in this order and not merged: the first is transactional and removes our
   * data, the second reaches out to Firebase and OneSignal and cannot be. Committing the
   * delete before making network calls is what stops a slow push provider from holding a
   * database transaction open — and what guarantees the user's data is gone even if those
   * calls fail.
   */
  @DeleteMapping("/me")
  public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal FirebasePrincipal principal) {
    userService.deleteByFirebaseUid(principal.uid());
    userService.purgeExternalIdentity(principal.uid());
    return ResponseEntity.noContent().build();
  }
}
