package app.ittekimasu.server.controller;

import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.ittekimasu.server.config.SecurityConfig;
import app.ittekimasu.server.config.WebMvcConfig;
import app.ittekimasu.server.dto.request.RevenueCatEventRequest;
import app.ittekimasu.server.exception.GlobalExceptionHandler;
import app.ittekimasu.server.service.EntitlementService;
import com.google.firebase.auth.FirebaseAuth;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * This is the only unauthenticated route in the app, so the tests that matter here are the
 * ones about who gets turned away.
 */
@WebMvcTest(RevenueCatWebhookController.class)
@Import({SecurityConfig.class, WebMvcConfig.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = "revenuecat.webhook-authorization=shared-secret-abc")
class RevenueCatWebhookControllerTest {

  private static final String BODY =
      """
      {
        "api_version": "1.0",
        "event": {
          "id": "evt-1",
          "type": "INITIAL_PURCHASE",
          "app_user_id": "firebase-uid-123",
          "original_app_user_id": "firebase-uid-123",
          "product_id": "ittekimasu_monthly",
          "entitlement_ids": ["ittekimasu_pro"],
          "expiration_at_ms": 1800000000000,
          "a_field_revenuecat_added_later": "must not 400"
        }
      }
      """;

  @Autowired private MockMvc mockMvc;

  @MockitoBean private FirebaseAuth firebaseAuth;
  @MockitoBean private EntitlementService entitlementService;

  @Test
  void acceptsAnEventCarryingTheSharedSecret() throws Exception {
    mockMvc
        .perform(
            post("/api/webhooks/revenuecat")
                .header(HttpHeaders.AUTHORIZATION, "shared-secret-abc")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isOk());

    ArgumentCaptor<RevenueCatEventRequest> captor =
        ArgumentCaptor.forClass(RevenueCatEventRequest.class);
    then(entitlementService).should().handleWebhookEvent(captor.capture());

    var event = captor.getValue().event();
    org.assertj.core.api.Assertions.assertThat(event.type()).isEqualTo("INITIAL_PURCHASE");
    org.assertj.core.api.Assertions.assertThat(event.appUserId()).isEqualTo("firebase-uid-123");
    org.assertj.core.api.Assertions.assertThat(event.entitlementIds())
        .containsExactly("ittekimasu_pro");
    org.assertj.core.api.Assertions.assertThat(event.expirationAtMs())
        .isEqualTo(1_800_000_000_000L);
  }

  @Test
  void rejectsAnEventWithTheWrongSecret() throws Exception {
    mockMvc
        .perform(
            post("/api/webhooks/revenuecat")
                .header(HttpHeaders.AUTHORIZATION, "not-the-secret")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isUnauthorized());

    then(entitlementService).should(never()).handleWebhookEvent(org.mockito.ArgumentMatchers.any());
  }

  /** No Firebase token needed here — but no header at all still means no. */
  @Test
  void rejectsAnEventWithNoAuthorizationHeader() throws Exception {
    mockMvc
        .perform(
            post("/api/webhooks/revenuecat")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isUnauthorized());

    then(entitlementService).should(never()).handleWebhookEvent(org.mockito.ArgumentMatchers.any());
  }
}
