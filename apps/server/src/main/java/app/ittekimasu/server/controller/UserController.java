package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.request.UpdateRemindersRequest;
import app.ittekimasu.server.dto.response.EntitlementResponse;
import app.ittekimasu.server.dto.response.UserResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.EntitlementService;
import app.ittekimasu.server.service.ReviewService;
import app.ittekimasu.server.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {

  private final UserService userService;
  private final EntitlementService entitlementService;

  public UserController(UserService userService, EntitlementService entitlementService) {
    this.userService = userService;
    this.entitlementService = entitlementService;
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

  /** Account deletion, required by App Store review guideline 5.1.1(v). */
  @DeleteMapping("/me")
  public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal FirebasePrincipal principal) {
    userService.deleteByFirebaseUid(principal.uid());
    return ResponseEntity.noContent().build();
  }
}
