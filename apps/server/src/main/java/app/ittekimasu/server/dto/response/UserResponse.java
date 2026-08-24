package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.User;
import java.time.Instant;
import java.util.UUID;

public record UserResponse(
    UUID id,
    String email,
    String displayName,
    Instant createdAt,
    /** Consecutive days with at least one review — the flame on the learn tab. */
    int currentStreakDays,
    int longestStreakDays) {

  public static UserResponse from(User user) {
    return new UserResponse(
        user.getId(),
        user.getEmail(),
        user.getDisplayName(),
        user.getCreatedAt(),
        user.getCurrentStreakDays(),
        user.getLongestStreakDays());
  }
}
