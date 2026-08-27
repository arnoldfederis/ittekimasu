package app.ittekimasu.server.service;

import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.ResourceNotFoundException;
import app.ittekimasu.server.repository.UserRepository;
import app.ittekimasu.server.security.FirebasePrincipal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
  private final UserRepository userRepository;

  public UserService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Resolves the caller's row, creating it on first sight. Firebase already handled signup, so
   * there is no register endpoint — the first authenticated request is the registration.
   */
  @Transactional
  public User findOrCreate(FirebasePrincipal principal) {
    return userRepository
        .findByFirebaseUid(principal.uid())
        .map(existing -> backfill(existing, principal))
        .orElseGet(() -> create(principal));
  }

  @Transactional(readOnly = true)
  public User requireByFirebaseUid(String firebaseUid) {
    return userRepository
        .findByFirebaseUid(firebaseUid)
        .orElseThrow(() -> new ResourceNotFoundException("User", firebaseUid));
  }

  /**
   * Sets or clears the daily reminder.
   *
   * <p>Loads the user again inside this transaction: {@link #findOrCreate} hands back a
   * DETACHED entity, so writing to that one would silently never flush.
   */
  @Transactional
  public User updateReminders(UUID userId, Integer reminderHour, String reminderTimezone) {
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User", userId));

    user.setReminderHour(reminderHour == null ? null : reminderHour.shortValue());
    // Clearing the hour clears the zone with it, rather than leaving a zone pointing at
    // nothing for the next reader to puzzle over.
    user.setReminderTimezone(reminderHour == null ? null : reminderTimezone);

    return user;
  }

  /**
   * Marks onboarding finished without adopting a checklist — the "I only want the language
   * decks" path.
   *
   * <p>Idempotent, and it never moves an existing timestamp: re-running onboarding later to
   * build a checklist should not rewrite the day this person actually started.
   */
  @Transactional
  public User completeOnboarding(UUID userId) {
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User", userId));

    if (user.getOnboardedAt() == null) {
      user.setOnboardedAt(Instant.now());
    }
    return user;
  }

  /** Account deletion, required by App Store review guideline 5.1.1(v). */
  @Transactional
  public void deleteByFirebaseUid(String firebaseUid) {
    userRepository.delete(requireByFirebaseUid(firebaseUid));
  }

  private User create(FirebasePrincipal principal) {
    User user = new User();
    user.setFirebaseUid(principal.uid());
    user.setEmail(principal.email());
    user.setDisplayName(principal.name());
    return userRepository.save(user);
  }

  /**
   * Fills in fields the token now carries but the row is missing. Never overwrites a value the
   * user already has — Apple stops sending the name after the first sign-in, so blindly copying
   * the token would wipe it.
   */
  private User backfill(User user, FirebasePrincipal principal) {
    if (user.getDisplayName() == null && principal.name() != null) {
      user.setDisplayName(principal.name());
    }
    if (principal.email() != null && !principal.email().equals(user.getEmail())) {
      user.setEmail(principal.email());
    }
    return user;
  }
}
