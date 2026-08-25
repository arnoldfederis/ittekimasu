package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.response.EntitlementResponse;
import app.ittekimasu.server.dto.response.UserResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.EntitlementService;
import app.ittekimasu.server.service.ReviewService;
import app.ittekimasu.server.service.UserService;
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
