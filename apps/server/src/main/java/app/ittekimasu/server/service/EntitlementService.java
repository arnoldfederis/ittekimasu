package app.ittekimasu.server.service;

import app.ittekimasu.server.dto.request.RevenueCatEventRequest;
import app.ittekimasu.server.dto.response.EntitlementResponse;
import app.ittekimasu.server.entity.Entitlement;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.BadRequestException;
import app.ittekimasu.server.repository.EntitlementRepository;
import app.ittekimasu.server.repository.UserRepository;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The single source of truth for "is this user premium".
 *
 * <p>Nothing here reads a client-supplied flag. The mobile app knows its own entitlement from
 * the RevenueCat SDK, but that is for rendering only — every gate on the server asks this
 * service, which asks the database, which is written only by the webhook.
 */
@Service
public class EntitlementService {

  private static final Logger log = LoggerFactory.getLogger(EntitlementService.class);

  /** Matches the entitlement identifier configured in the RevenueCat dashboard. */
  public static final String PREMIUM_ENTITLEMENT_ID = "ittekimasu_pro";

  /** Events that mean the user has access from now on. */
  private static final Set<String> GRANTING =
      Set.of("INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "SUBSCRIPTION_EXTENDED");

  /**
   * Events that mean the user does not.
   *
   * <p>CANCELLATION is deliberately here even though the user keeps access until the period
   * ends in RevenueCat's own model: the EXPIRATION event is the one that truly ends it. This
   * follows the mapping written down in CLAUDE.md — revisit it together with that line, not
   * on its own, or the doc and the code drift.
   */
  private static final Set<String> REVOKING =
      Set.of("CANCELLATION", "EXPIRATION", "BILLING_ISSUE", "REFUND", "SUBSCRIPTION_PAUSED");

  private final EntitlementRepository entitlementRepository;
  private final UserRepository userRepository;

  public EntitlementService(
      EntitlementRepository entitlementRepository, UserRepository userRepository) {
    this.entitlementRepository = entitlementRepository;
    this.userRepository = userRepository;
  }

  /** True when the user may use premium decks and unlimited reviews. */
  @Transactional(readOnly = true)
  public boolean isPremium(UUID userId) {
    return entitlementRepository.findByUserId(userId).map(Entitlement::isPremium).orElse(false);
  }

  @Transactional(readOnly = true)
  public EntitlementResponse getEntitlement(UUID userId, int freeDailyReviewLimit) {
    return EntitlementResponse.from(
        entitlementRepository.findByUserId(userId).orElse(null), freeDailyReviewLimit);
  }

  /**
   * Applies one webhook event.
   *
   * <p>Unknown event types are recorded and ignored rather than rejected. RevenueCat adds
   * event types over time, and answering 4xx would make it retry a payload that will never
   * succeed — and eventually disable the webhook.
   */
  @Transactional
  public void handleWebhookEvent(RevenueCatEventRequest request) {
    RevenueCatEventRequest.Event event = request == null ? null : request.event();
    if (event == null || event.type() == null) {
      throw new BadRequestException("Webhook payload has no event.");
    }

    User user = resolveUser(event);
    if (user == null) {
      // Not an error worth retrying: a TEST event from the dashboard carries a made-up id.
      log.warn(
          "RevenueCat event {} ({}) references unknown app_user_id {}",
          event.id(),
          event.type(),
          event.appUserId());
      return;
    }

    // A project can sell more than one entitlement later. Only ours moves this flag.
    if (event.entitlementIds() != null
        && !event.entitlementIds().isEmpty()
        && !event.entitlementIds().contains(PREMIUM_ENTITLEMENT_ID)) {
      log.info(
          "Ignoring RevenueCat event {} for unrelated entitlements {}",
          event.id(),
          event.entitlementIds());
      return;
    }

    String type = event.type().toUpperCase(Locale.ROOT);
    Entitlement entitlement =
        entitlementRepository
            .findByUserId(user.getId())
            .orElseGet(
                () -> {
                  Entitlement fresh = new Entitlement();
                  fresh.setUser(user);
                  return fresh;
                });

    if (GRANTING.contains(type)) {
      entitlement.setPremium(true);
    } else if (REVOKING.contains(type)) {
      entitlement.setPremium(false);
    } else {
      log.info("Ignoring unhandled RevenueCat event type {}", type);
    }

    if (event.originalAppUserId() != null) {
      entitlement.setRevenueCatCustomerId(event.originalAppUserId());
    }
    if (event.expirationAtMs() != null) {
      entitlement.setExpiresAt(Instant.ofEpochMilli(event.expirationAtMs()));
    }
    entitlement.setLastEventType(type);

    entitlementRepository.save(entitlement);
  }

  /**
   * The app calls Purchases.logIn with the Firebase UID, so app_user_id is that UID. The
   * original id is checked too: RevenueCat sends the pre-alias anonymous id on some events.
   */
  private User resolveUser(RevenueCatEventRequest.Event event) {
    return userRepository
        .findByFirebaseUid(event.appUserId() == null ? "" : event.appUserId())
        .or(
            () ->
                event.originalAppUserId() == null
                    ? java.util.Optional.empty()
                    : userRepository.findByFirebaseUid(event.originalAppUserId()))
        .orElse(null);
  }
}
