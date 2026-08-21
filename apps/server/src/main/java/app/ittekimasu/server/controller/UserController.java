package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.response.UserResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {

  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @GetMapping("/me")
  public UserResponse me(@AuthenticationPrincipal FirebasePrincipal principal) {
    return UserResponse.from(userService.findOrCreate(principal));
  }

  /** Account deletion, required by App Store review guideline 5.1.1(v). */
  @DeleteMapping("/me")
  public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal FirebasePrincipal principal) {
    userService.deleteByFirebaseUid(principal.uid());
    return ResponseEntity.noContent().build();
  }
}
