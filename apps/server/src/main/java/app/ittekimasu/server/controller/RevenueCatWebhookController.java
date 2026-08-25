package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.request.RevenueCatEventRequest;
import app.ittekimasu.server.service.EntitlementService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * RevenueCat posts here. This route is the one thing SecurityConfig lets through unauthenticated
 * — RevenueCat has no Firebase token — so the shared secret below is the ONLY thing standing
 * between the open internet and "make me premium".
 */
@RestController
@RequestMapping("/webhooks")
public class RevenueCatWebhookController {

  private final EntitlementService entitlementService;
  private final String expectedAuthorization;

  public RevenueCatWebhookController(
      EntitlementService entitlementService,
      @Value("${revenuecat.webhook-authorization:}") String expectedAuthorization) {
    this.entitlementService = entitlementService;
    this.expectedAuthorization = expectedAuthorization;
  }

  /**
   * Always 200 on a payload we accepted, even when the event was ignored: any other status
   * makes RevenueCat retry, and eventually disable the webhook.
   */
  @PostMapping("/revenuecat")
  public ResponseEntity<Void> handle(
      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
      @RequestBody RevenueCatEventRequest request) {
    if (!authorized(authorization)) {
      return ResponseEntity.status(401).build();
    }

    entitlementService.handleWebhookEvent(request);
    return ResponseEntity.ok().build();
  }

  /**
   * Fails closed. With no secret configured every request is rejected — the alternative,
   * treating "unset" as "allow", turns a missing env var in production into a free premium
   * endpoint, and nothing would look broken until someone found it.
   */
  private boolean authorized(String authorization) {
    if (expectedAuthorization == null || expectedAuthorization.isBlank() || authorization == null) {
      return false;
    }

    // Constant-time: a plain equals leaks the secret one character at a time to anyone
    // willing to measure the response.
    return MessageDigest.isEqual(
        authorization.getBytes(StandardCharsets.UTF_8),
        expectedAuthorization.getBytes(StandardCharsets.UTF_8));
  }
}
