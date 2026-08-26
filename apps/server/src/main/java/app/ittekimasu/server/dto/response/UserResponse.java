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
    int longestStreakDays,
    /** 0-23, or null when the daily reminder is off. */
    Integer reminderHour,
    String reminderTimezone) {

  public static UserResponse from(User user) {
    return new UserResponse(
        user.getId(),
        user.getEmail(),
        user.getDisplayName(),
        user.getCreatedAt(),
        user.getCurrentStreakDays(),
        user.getLongestStreakDays(),
        user.getReminderHour() == null ? null : user.getReminderHour().intValue(),
        user.getReminderTimezone());
  }
}
