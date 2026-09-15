package app.ittekimasu.server.service;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Sends push through OneSignal's REST API.
 *
 * <p>Targeting is by <b>external id</b>, which for this app is the Firebase UID — the same id
 * RevenueCat sees as {@code app_user_id}. One identity across all three systems means no
 * lookup table anywhere.
 */
@Component
public class OneSignalClient {

  private static final Logger log = LoggerFactory.getLogger(OneSignalClient.class);

  /** OneSignal accepts up to 2000 aliases per request. */
  public static final int MAX_ALIASES_PER_REQUEST = 2000;

  private final RestClient restClient;
  private final String appId;
  private final String apiKey;
  private final String authScheme;

  public OneSignalClient(
      @Value("${onesignal.app-id:}") String appId,
      @Value("${onesignal.rest-api-key:}") String apiKey,
      @Value("${onesignal.auth-scheme:Key}") String authScheme) {
    // RestClient.create rather than an injected builder: Boot does not contribute a
    // RestClient.Builder bean here, and this client needs no shared interceptors anyway.
    this.restClient = RestClient.create("https://api.onesignal.com");
    this.appId = appId;
    this.apiKey = apiKey;
    this.authScheme = authScheme;
  }

  /** False when the credentials are missing, so the scheduler can skip the work entirely. */
  public boolean isConfigured() {
    return !appId.isBlank() && !apiKey.isBlank();
  }

  /**
   * Pushes one message to a batch of external ids.
   *
   * <p>Returns false rather than throwing: a failed reminder is not worth aborting the whole
   * scheduled run over, and the next tick will not retry it — that is deliberate, because a
   * reminder that arrives an hour late is worse than one that never comes.
   *
   * <p>The response BODY is what matters, not the status. OneSignal answers 200 with an
   * {@code errors} object when an external id matches no subscription, so treating 2xx as
   * success reports a delivery that never happened.
   */
  public boolean send(List<String> externalIds, String heading, String content) {
    if (!isConfigured() || externalIds.isEmpty()) {
      return false;
    }

    Map<String, Object> body =
        Map.of(
            "app_id", appId,
            "target_channel", "push",
            "include_aliases", Map.of("external_id", externalIds),
            "headings", Map.of("en", heading),
            "contents", Map.of("en", content));

    try {
      String response =
          restClient
              .post()
              .uri("/notifications")
              // Newer OneSignal keys use "Key <token>"; older ones expect "Basic <token>".
              // The scheme is configurable because getting it wrong is a silent 401.
              .header("Authorization", "%s %s".formatted(authScheme, apiKey))
              .contentType(MediaType.APPLICATION_JSON)
              .body(body)
              .retrieve()
              .body(String.class);

      String payload = response == null ? "" : response;

      /*
       * `invalid_aliases` is an expected outcome, not a fault, and must not be logged as
       * one. It means OneSignal has no subscription for that external id — the person
       * uninstalled, or signed in under a different account so their device re-registered
       * under a new Firebase UID and the old one was left behind.
       *
       * Either way it recurs EVERY DAY for as long as that row keeps a reminder hour, so
       * logging it at ERROR would fill the log with a permanent false alarm and train us to
       * stop reading it. The reminder hour is deliberately left alone: reinstalling and
       * signing in re-registers the device, and the reminder should simply start working
       * again rather than needing to be set up a second time.
       */
      if (payload.contains("\"invalid_aliases\"")) {
        log.info(
            "OneSignal has no subscription for some of the {} recipients in this batch —"
                + " uninstalled, or re-registered under a different account: {}",
            externalIds.size(),
            payload);
        return false;
      }

      if (payload.contains("\"errors\"")) {
        log.error(
            "OneSignal accepted the request but reported errors for {} recipients: {}",
            externalIds.size(),
            payload);
        return false;
      }

      log.info("OneSignal accepted push for {} recipients: {}", externalIds.size(), payload);
      return true;
    } catch (Exception ex) {
      log.error("OneSignal push failed for {} recipients", externalIds.size(), ex);
      return false;
    }
  }

  /**
   * Forgets a user, by the external id the app set with {@code OneSignal.login(firebaseUid)}.
   *
   * <p>Called when an account is deleted. Without it the push token, the device record and
   * the external id outlive the account — and the privacy policy says deleting an account
   * removes what is held for it.
   *
   * <p>Best-effort by design: it returns false rather than throwing, because a push provider
   * being unreachable must never be the reason someone cannot delete their account. A 404 is
   * a success in every sense that matters — the user was already gone, or never had a
   * subscription because they declined notifications.
   */
  public boolean deleteUser(String externalId) {
    if (!isConfigured() || externalId == null || externalId.isBlank()) {
      return false;
    }

    try {
      restClient
          .delete()
          .uri("/apps/{appId}/users/by/external_id/{externalId}", appId, externalId)
          .header("Authorization", "%s %s".formatted(authScheme, apiKey))
          .retrieve()
          .toBodilessEntity();

      log.info("OneSignal user deleted for external id {}", externalId);
      return true;
    } catch (Exception ex) {
      log.warn("OneSignal delete failed for external id {}: {}", externalId, ex.getMessage());
      return false;
    }
  }
}
