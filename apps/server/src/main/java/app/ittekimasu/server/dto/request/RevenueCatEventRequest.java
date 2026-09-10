package app.ittekimasu.server.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * A RevenueCat webhook body.
 *
 * <p>{@code ignoreUnknown} is mandatory, not tidiness: RevenueCat adds fields to these payloads
 * without warning, and a strict mapper would start 400-ing live webhooks the day they do.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RevenueCatEventRequest(
    @JsonProperty("api_version") String apiVersion, Event event) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Event(
      String id,
      /** INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, ... */
      String type,
      /** Whatever the app passed to Purchases.logIn — for this app, the Firebase UID. */
      @JsonProperty("app_user_id") String appUserId,
      /** Set when RevenueCat has merged anonymous and identified users. */
      @JsonProperty("original_app_user_id") String originalAppUserId,
      @JsonProperty("product_id") String productId,
      @JsonProperty("entitlement_ids") List<String> entitlementIds,
      @JsonProperty("expiration_at_ms") Long expirationAtMs,
      /*
       * TRANSFER events carry NO app_user_id and NO entitlement_ids — the two ids involved
       * arrive as these arrays instead. Each holds the store's anonymous id ($RCAnonymousID:…)
       * alongside the Firebase UID, so both are searched and the anonymous one simply matches
       * nothing.
       *
       * Without these fields a transfer resolved to no user at all and was dropped, which is
       * how a subscriber ends up premium in RevenueCat and free in our database.
       */
      @JsonProperty("transferred_from") List<String> transferredFrom,
      @JsonProperty("transferred_to") List<String> transferredTo) {}
}
