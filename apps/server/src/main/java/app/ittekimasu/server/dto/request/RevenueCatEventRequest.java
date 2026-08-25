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
      @JsonProperty("expiration_at_ms") Long expirationAtMs) {}
}
