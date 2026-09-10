package app.ittekimasu.server.service;

import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.ResourceNotFoundException;
import app.ittekimasu.server.repository.UserRepository;
import app.ittekimasu.server.security.FirebasePrincipal;
import com.google.firebase.auth.FirebaseAuth;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

  private static final Logger log = LoggerFactory.getLogger(UserService.class);

  private final UserRepository userRepository;
  private final FirebaseAuth firebaseAuth;
  private final OneSignalClient oneSignal;

  public UserService(
      UserRepository userRepository, FirebaseAuth firebaseAuth, OneSignalClient oneSignal) {
    this.userRepository = userRepository;
    this.firebaseAuth = firebaseAuth;
    this.oneSignal = oneSignal;
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

  /**
   * Removes the identities this account owns outside our database.
   *
   * <p>Deliberately NOT transactional and deliberately called AFTER the row is gone. Two
   * reasons for that order:
   *
   * <ul>
   *   <li>Deleting our data is the part that must succeed. If Firebase is unreachable the
   *       user still gets what they asked for, and the worst case is an auth account that
   *       can sign in to a brand-new empty one.
   *   <li>The reverse order is much worse: delete the identity first and a database failure
   *       leaves someone locked out of data that still exists.
   * </ul>
   *
   * <p>Every failure is logged and swallowed. An outage at a push provider must never be the
   * reason a deletion request fails — App Store guideline 5.1.1(v) is about the user always
   * being able to leave.
   *
   * <p>RevenueCat is intentionally absent. Apple requires purchases to stay restorable
   * (3.1.1), and someone who deletes an account while still being billed needs that history
   * to exist — deleting the subscriber would throw away the only record tying that payment
   * to anything. Cancelling is done through Apple, which Settings links to.
   *
   * <p>Sentry is absent too, for the opposite reason: `sendDefaultPii: false` and no
   * `setUser` call mean there is no identity in a crash report to delete.
   */
  public void purgeExternalIdentity(String firebaseUid) {
    // Push first: it is the cheaper failure, and it needs no Firebase record to exist.
    oneSignal.deleteUser(firebaseUid);

    try {
      firebaseAuth.deleteUser(firebaseUid);
      log.info("Firebase user deleted for uid {}", firebaseUid);
    } catch (Exception ex) {
      /*
       * Left in place, the auth record means signing in with the same Apple ID lands on a
       * fresh empty row — and Apple only returns the display name on the FIRST sign-in
       * ever, so that row can never recover it. Worth a warning rather than silence.
       */
      log.warn("Firebase delete failed for uid {}: {}", firebaseUid, ex.getMessage());
    }
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
