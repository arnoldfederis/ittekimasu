package app.ittekimasu.server.service;

import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.ResourceNotFoundException;
import app.ittekimasu.server.repository.UserRepository;
import app.ittekimasu.server.security.FirebasePrincipal;
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
