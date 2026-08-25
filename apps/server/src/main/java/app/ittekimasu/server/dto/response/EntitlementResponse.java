package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.Entitlement;
import java.time.Instant;

/**
 * What the client is allowed to do. The client displays this; it never decides it.
 *
 * @param dailyReviewLimit null means unlimited. A sentinel like -1 reads as a real number in
 *     "{limit} cards a day" copy, and someone eventually renders it.
 */
public record EntitlementResponse(boolean premium, Instant expiresAt, Integer dailyReviewLimit) {

  /** A null entitlement means the webhook has never fired for this user: free. */
  public static EntitlementResponse from(Entitlement entitlement, int freeDailyReviewLimit) {
    return entitlement == null || !entitlement.isPremium()
        ? new EntitlementResponse(false, null, freeDailyReviewLimit)
        : new EntitlementResponse(true, entitlement.getExpiresAt(), null);
  }
}
