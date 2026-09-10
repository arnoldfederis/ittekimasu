package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.ittekimasu.server.dto.request.RevenueCatEventRequest;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.repository.EntitlementRepository;
import app.ittekimasu.server.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * The webhook is the only writer of premium access, so the mapping is worth proving against a
 * real upsert rather than a mock.
 *
 * <p>Needs Postgres running (`devbox run dev up`).
 */
@SpringBootTest
@Transactional
class EntitlementServiceIntegrationTest {

  @Autowired private EntitlementService entitlementService;
  @Autowired private EntitlementRepository entitlementRepository;
  @Autowired private UserRepository userRepository;

  private User user;

  @BeforeEach
  void setUp() {
    user = new User();
    user.setFirebaseUid("entitlement-test-" + UUID.randomUUID());
    user.setEmail("entitlement-test@ittekimasu.app");
    user = userRepository.save(user);
  }

  @Test
  void aNewUserIsNotPremium() {
    assertThat(entitlementService.isPremium(user.getId())).isFalse();
    assertThat(entitlementService.getEntitlement(user.getId(), 20).dailyReviewLimit())
        .isEqualTo(20);
  }

  @Test
  void anInitialPurchaseGrantsPremium() {
    entitlementService.handleWebhookEvent(event("INITIAL_PURCHASE", 1_800_000_000_000L));

    assertThat(entitlementService.isPremium(user.getId())).isTrue();

    var response = entitlementService.getEntitlement(user.getId(), 20);
    assertThat(response.premium()).isTrue();
    // Null, not a sentinel: premium has no daily cap to render.
    assertThat(response.dailyReviewLimit()).isNull();
    assertThat(response.expiresAt()).isEqualTo(Instant.ofEpochMilli(1_800_000_000_000L));
  }

  @Test
  void anExpirationRevokesIt() {
    entitlementService.handleWebhookEvent(event("INITIAL_PURCHASE", 1_800_000_000_000L));
    entitlementService.handleWebhookEvent(event("EXPIRATION", 1_800_000_000_000L));

    assertThat(entitlementService.isPremium(user.getId())).isFalse();
  }

  @Test
  void aRenewalKeepsItAndMovesTheExpiry() {
    entitlementService.handleWebhookEvent(event("INITIAL_PURCHASE", 1_800_000_000_000L));
    entitlementService.handleWebhookEvent(event("RENEWAL", 1_900_000_000_000L));

    var entitlement = entitlementRepository.findByUserId(user.getId()).orElseThrow();
    assertThat(entitlement.isPremium()).isTrue();
    assertThat(entitlement.getExpiresAt()).isEqualTo(Instant.ofEpochMilli(1_900_000_000_000L));
    assertThat(entitlement.getLastEventType()).isEqualTo("RENEWAL");
  }

  /** Exactly one row per user — a second event must upsert, not insert. */
  @Test
  void repeatedEventsUpsertTheSameRow() {
    entitlementService.handleWebhookEvent(event("INITIAL_PURCHASE", 1_800_000_000_000L));
    entitlementService.handleWebhookEvent(event("RENEWAL", 1_900_000_000_000L));
    entitlementService.handleWebhookEvent(event("RENEWAL", 2_000_000_000_000L));

    assertThat(entitlementRepository.findAll().stream().filter(e -> e.getUser().getId().equals(user.getId())))
        .hasSize(1);
  }

  /** A dashboard test event names a user who does not exist. That is a warning, not a 500. */
  @Test
  void anUnknownAppUserIdIsIgnored() {
    var unknown =
        new RevenueCatEventRequest(
            "1.0",
            new RevenueCatEventRequest.Event(
                "evt-unknown",
                "INITIAL_PURCHASE",
                "nobody-has-this-uid",
                null,
                "ittekimasu_monthly",
                List.of(EntitlementService.PREMIUM_ENTITLEMENT_ID),
                null,
                null,
                null));

    entitlementService.handleWebhookEvent(unknown);

    assertThat(entitlementService.isPremium(user.getId())).isFalse();
  }

  /** A future second entitlement must not move this flag. */
  @Test
  void anEventForAnotherEntitlementIsIgnored() {
    var other =
        new RevenueCatEventRequest(
            "1.0",
            new RevenueCatEventRequest.Event(
                "evt-other",
                "INITIAL_PURCHASE",
                user.getFirebaseUid(),
                null,
                "some_other_product",
                List.of("something_else"),
                null,
                null,
                null));

    entitlementService.handleWebhookEvent(other);

    assertThat(entitlementService.isPremium(user.getId())).isFalse();
  }

  /** Unknown types are recorded and ignored: 4xx would make RevenueCat retry forever. */
  @Test
  void anUnknownEventTypeLeavesAccessUnchanged() {
    entitlementService.handleWebhookEvent(event("INITIAL_PURCHASE", 1_800_000_000_000L));
    entitlementService.handleWebhookEvent(event("SOME_FUTURE_EVENT", null));

    assertThat(entitlementService.isPremium(user.getId())).isTrue();
  }

  /**
   * A TRANSFER moves an active subscription from one app_user_id to another — which happens
   * in ordinary use, not just in testing: delete your account and sign in again, or restore
   * onto a second account under the same Apple ID.
   *
   * <p>The event carries NO app_user_id and NO entitlement_ids, only the two arrays. Before
   * this was handled, it resolved to no user and was silently dropped, leaving the receiving
   * account premium in RevenueCat and free here — so every premium deck answered 402 while
   * the app showed them unlocked.
   */
  @Test
  void aTransferMovesPremiumBetweenAccounts() {
    User recipient = new User();
    recipient.setFirebaseUid("entitlement-test-" + UUID.randomUUID());
    recipient.setEmail("entitlement-recipient@ittekimasu.app");
    recipient = userRepository.save(recipient);

    // The original owner is premium.
    entitlementService.handleWebhookEvent(event("INITIAL_PURCHASE", 1_800_000_000_000L));
    assertThat(entitlementService.isPremium(user.getId())).isTrue();

    entitlementService.handleWebhookEvent(transfer(user, recipient));

    assertThat(entitlementService.isPremium(recipient.getId())).isTrue();
    // And the losing side loses it: nothing later would correct this, because RevenueCat
    // sends that account no further events about a subscription it no longer owns.
    assertThat(entitlementService.isPremium(user.getId())).isFalse();
  }

  /** An anonymous id on either side matches no user and must not break the transfer. */
  @Test
  void aTransferIgnoresAnonymousIdsAndUnknownUsers() {
    User recipient = new User();
    recipient.setFirebaseUid("entitlement-test-" + UUID.randomUUID());
    recipient.setEmail("entitlement-recipient2@ittekimasu.app");
    recipient = userRepository.save(recipient);

    RevenueCatEventRequest request =
        new RevenueCatEventRequest(
            "1.0",
            new RevenueCatEventRequest.Event(
                "evt-" + UUID.randomUUID(),
                "TRANSFER",
                null,
                null,
                null,
                null,
                null,
                List.of("$RCAnonymousID:f54e230df72f42bb9084dffa5d094c2e", "never-seen-uid"),
                List.of("$RCAnonymousID:506c7192400a4f87b4ca631a64777dac",
                    recipient.getFirebaseUid())));

    entitlementService.handleWebhookEvent(request);

    assertThat(entitlementService.isPremium(recipient.getId())).isTrue();
  }

  private RevenueCatEventRequest event(String type, Long expirationAtMs) {
    return new RevenueCatEventRequest(
        "1.0",
        new RevenueCatEventRequest.Event(
            "evt-" + UUID.randomUUID(),
            type,
            user.getFirebaseUid(),
            user.getFirebaseUid(),
            "ittekimasu_monthly",
            List.of(EntitlementService.PREMIUM_ENTITLEMENT_ID),
            expirationAtMs,
            null,
            null));
  }

  /** Shaped like the real payload: no app_user_id, no entitlement_ids, two arrays. */
  private RevenueCatEventRequest transfer(User from, User to) {
    return new RevenueCatEventRequest(
        "1.0",
        new RevenueCatEventRequest.Event(
            "evt-" + UUID.randomUUID(),
            "TRANSFER",
            null,
            null,
            null,
            null,
            null,
            List.of("$RCAnonymousID:" + UUID.randomUUID(), from.getFirebaseUid()),
            List.of("$RCAnonymousID:" + UUID.randomUUID(), to.getFirebaseUid())));
  }
}
