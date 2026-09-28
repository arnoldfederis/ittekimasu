package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.ittekimasu.server.dto.request.KanaProgressItemRequest;
import app.ittekimasu.server.dto.response.KanaProgressResponse;
import app.ittekimasu.server.entity.Entitlement;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.PaymentRequiredException;
import app.ittekimasu.server.repository.EntitlementRepository;
import app.ittekimasu.server.repository.UserRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * The kana backup's merge rule, against a real upsert: running totals from the device, and the
 * server keeps the larger of each value. That is what makes a retried or replayed upload
 * harmless, and it only holds if the SQL does it — a mock would prove nothing.
 *
 * <p>Needs Postgres running (`devbox run dev up`).
 */
@SpringBootTest
@Transactional
class KanaProgressServiceIntegrationTest {

  @Autowired private KanaProgressService kanaProgressService;
  @Autowired private ReviewService reviewService;
  @Autowired private UserRepository userRepository;
  @Autowired private EntitlementRepository entitlementRepository;

  private User user;

  @BeforeEach
  void setUp() {
    user = new User();
    user.setFirebaseUid("kana-progress-test-" + UUID.randomUUID());
    user.setEmail("kana-progress-test@ittekimasu.app");
    user = userRepository.save(user);
  }

  @Test
  void theFreePlanCannotBackUpOrRestore() {
    assertThatThrownBy(() -> kanaProgressService.list(user.getId()))
        .isInstanceOf(PaymentRequiredException.class);
    assertThatThrownBy(
            () -> kanaProgressService.sync(user.getId(), List.of(item("あ", 1, 1, 900))))
        .isInstanceOf(PaymentRequiredException.class);
  }

  @Test
  void aSnapshotIsStoredAndReturned() {
    grantPro();

    List<KanaProgressResponse> merged =
        kanaProgressService.sync(
            user.getId(), List.of(item("あ", 2, 3, 4000), item("ヂャ", 0, 1, 2500)));

    assertThat(merged)
        .containsExactlyInAnyOrder(
            new KanaProgressResponse("あ", 2, 3, 4000),
            new KanaProgressResponse("ヂャ", 0, 1, 2500));
    assertThat(kanaProgressService.list(user.getId())).hasSize(2);
  }

  @Test
  void sendingTheSameSnapshotTwiceChangesNothing() {
    grantPro();
    List<KanaProgressItemRequest> snapshot = List.of(item("か", 4, 5, 6000));

    kanaProgressService.sync(user.getId(), snapshot);
    // A retry, or an offline upload replayed after reconnecting.
    List<KanaProgressResponse> again = kanaProgressService.sync(user.getId(), snapshot);

    assertThat(again).containsExactly(new KanaProgressResponse("か", 4, 5, 6000));
  }

  @Test
  void anOlderSnapshotNeverWindsProgressBack() {
    grantPro();
    kanaProgressService.sync(user.getId(), List.of(item("き", 6, 8, 9000)));

    // A second phone that has practised less, uploading afterwards.
    List<KanaProgressResponse> merged =
        kanaProgressService.sync(user.getId(), List.of(item("き", 2, 3, 12000)));

    // The larger of EACH value, independently: more time on the second phone still counts.
    assertThat(merged).containsExactly(new KanaProgressResponse("き", 6, 8, 12000));
  }

  @Test
  void startingLearningOverClearsTheBackup() {
    grantPro();
    kanaProgressService.sync(user.getId(), List.of(item("さ", 1, 1, 700)));

    reviewService.resetAllProgress(user.getId());

    assertThat(kanaProgressService.list(user.getId())).isEmpty();
  }

  private void grantPro() {
    Entitlement entitlement = new Entitlement();
    entitlement.setUser(user);
    entitlement.setPremium(true);
    entitlement.setLastEventType("INITIAL_PURCHASE");
    entitlementRepository.save(entitlement);
  }

  private static KanaProgressItemRequest item(
      String glyph, int correct, int attempts, long totalMs) {
    return new KanaProgressItemRequest(glyph, correct, attempts, totalMs);
  }
}
