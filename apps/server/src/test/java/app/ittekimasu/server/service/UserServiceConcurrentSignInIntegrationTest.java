package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.ittekimasu.server.repository.UserRepository;
import app.ittekimasu.server.security.FirebasePrincipal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Signing in fires several authenticated requests at once, and on a brand-new account every
 * one of them runs {@link UserService#findOrCreate}. They all read "no row yet", they all
 * insert, and before {@code insertIfAbsent} the losers died on {@code uc_users_firebase_uid}:
 *
 * <pre>ERROR: duplicate key value violates unique constraint "uc_users_firebase_uid"</pre>
 *
 * <p>A 500 on the first screen after sign-in, on the one path every user takes.
 *
 * <p>Deliberately NOT {@code @Transactional}: the point is several REAL transactions racing,
 * and a test-managed one would serialise them and prove nothing. That also means the rows
 * outlive the test, hence the explicit cleanup.
 *
 * <p>Needs Postgres running (`devbox run dev up`).
 */
@SpringBootTest
class UserServiceConcurrentSignInIntegrationTest {

  private static final int CONCURRENT_REQUESTS = 8;

  @Autowired private UserService userService;
  @Autowired private UserRepository userRepository;

  private final String firebaseUid = "concurrent-signin-" + UUID.randomUUID();

  @AfterEach
  void cleanUp() {
    userRepository.findByFirebaseUid(firebaseUid).ifPresent(userRepository::delete);
  }

  @Test
  void aFirstSignInRacingWithItselfCreatesExactlyOneUser() throws Exception {
    FirebasePrincipal principal =
        new FirebasePrincipal(firebaseUid, "race@ittekimasu.app", "Race Tester");

    List<Callable<UUID>> calls =
        java.util.Collections.nCopies(
            CONCURRENT_REQUESTS, () -> userService.findOrCreate(principal).getId());

    try (ExecutorService pool = Executors.newFixedThreadPool(CONCURRENT_REQUESTS)) {
      List<Future<UUID>> results = pool.invokeAll(calls);

      // Every caller must get an id back. Before the fix, all but one threw
      // DataIntegrityViolationException here.
      List<UUID> ids = new java.util.ArrayList<>();
      for (Future<UUID> result : results) {
        ids.add(result.get());
      }

      // And they must all be the SAME user — one row, not eight.
      assertThat(ids).hasSize(CONCURRENT_REQUESTS);
      assertThat(ids).containsOnly(ids.getFirst());
    }

    assertThat(userRepository.findByFirebaseUid(firebaseUid)).isPresent();
  }
}
