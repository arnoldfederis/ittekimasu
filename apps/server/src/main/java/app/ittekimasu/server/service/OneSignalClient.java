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
}
