package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.request.SubmitReviewRequest;
import app.ittekimasu.server.dto.response.ReviewResultResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.ReviewService;
import app.ittekimasu.server.service.UserService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** One answer, one call. Routes are declared without the /api prefix — WebMvcConfig adds it. */
@RestController
public class ReviewController {

  private final ReviewService reviewService;
  private final UserService userService;

  public ReviewController(ReviewService reviewService, UserService userService) {
    this.reviewService = reviewService;
    this.userService = userService;
  }

  /** 402 once the free daily allowance is spent — the client opens the paywall on that. */
  @PostMapping("/reviews/{cardId}")
  public ReviewResultResponse submitReview(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @PathVariable UUID cardId,
      @Valid @RequestBody SubmitReviewRequest request) {
    return reviewService.submitReview(
        userService.findOrCreate(principal).getId(), cardId, request.rating());
  }

  /**
   * Takes back the last answer for one card, restoring the schedule it had before.
   *
   * <p>DELETE rather than POST /undo: what is being removed is the most recent review of
   * this card, and the route reads as exactly that.
   */
  @DeleteMapping("/reviews/{cardId}")
  public ResponseEntity<Void> undoReview(
      @AuthenticationPrincipal FirebasePrincipal principal, @PathVariable UUID cardId) {
    reviewService.undoReview(userService.findOrCreate(principal).getId(), cardId);
    return ResponseEntity.noContent().build();
  }
}
