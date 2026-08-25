package app.ittekimasu.server.controller;

import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.ittekimasu.server.config.SecurityConfig;
import app.ittekimasu.server.config.WebMvcConfig;
import app.ittekimasu.server.exception.GlobalExceptionHandler;
import app.ittekimasu.server.service.EntitlementService;
import com.google.firebase.auth.FirebaseAuth;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * A missing secret must lock the door, not leave it open. Its own class because the property
 * is set per application context.
 */
@WebMvcTest(RevenueCatWebhookController.class)
@Import({SecurityConfig.class, WebMvcConfig.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = "revenuecat.webhook-authorization=")
class RevenueCatWebhookSecretMissingTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private FirebaseAuth firebaseAuth;
  @MockitoBean private EntitlementService entitlementService;

  @Test
  void rejectsEverythingWhenNoSecretIsConfigured() throws Exception {
    mockMvc
        .perform(
            post("/api/webhooks/revenuecat")
                .header(HttpHeaders.AUTHORIZATION, "anything")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"api_version\":\"1.0\",\"event\":{\"type\":\"INITIAL_PURCHASE\"}}"))
        .andExpect(status().isUnauthorized());

    then(entitlementService).should(never()).handleWebhookEvent(org.mockito.ArgumentMatchers.any());
  }
}
