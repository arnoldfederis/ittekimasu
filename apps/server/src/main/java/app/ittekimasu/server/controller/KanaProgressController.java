package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.request.KanaProgressSyncRequest;
import app.ittekimasu.server.dto.response.KanaProgressResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.KanaProgressService;
import app.ittekimasu.server.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * The kana quiz's Pro backup, under {@code /users/me} like everything else that belongs to the
 * signed-in learner. Its own controller rather than more routes on UserController, which is
 * already the widest class in the API.
 */
@RestController
@RequestMapping("/users")
public class KanaProgressController {

  private final UserService userService;
  private final KanaProgressService kanaProgressService;

  public KanaProgressController(
      UserService userService, KanaProgressService kanaProgressService) {
    this.userService = userService;
    this.kanaProgressService = kanaProgressService;
  }

  /** The backup, for a new install to restore. 402 on the free plan. */
  @GetMapping("/me/kana-progress")
  public List<KanaProgressResponse> list(@AuthenticationPrincipal FirebasePrincipal principal) {
    return kanaProgressService.list(userService.findOrCreate(principal).getId());
  }

  /**
   * Merges a device snapshot into the backup, keeping the larger of each value, and returns
   * the result. PATCH because it is a merge — safe to repeat, never a replacement. 402 on the
   * free plan.
   */
  @PatchMapping("/me/kana-progress")
  public List<KanaProgressResponse> sync(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @Valid @RequestBody KanaProgressSyncRequest request) {
    return kanaProgressService.sync(
        userService.findOrCreate(principal).getId(), request.items());
  }
}
