package app.ittekimasu.server.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.ittekimasu.server.config.SecurityConfig;
import app.ittekimasu.server.config.WebMvcConfig;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.dto.response.EntitlementResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.EntitlementService;
import app.ittekimasu.server.service.UserService;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(UserController.class)
@Import({SecurityConfig.class, WebMvcConfig.class})
class UserControllerTest {

  private static final String VALID_TOKEN = "valid-id-token";
  private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

  @Autowired private MockMvc mockMvc;

  @MockitoBean private FirebaseAuth firebaseAuth;
  @MockitoBean private UserService userService;
  @MockitoBean private EntitlementService entitlementService;

  @BeforeEach
  void stubFirebase() throws Exception {
    FirebaseToken token = org.mockito.Mockito.mock(FirebaseToken.class);
    given(token.getUid()).willReturn("firebase-uid-123");
    given(token.getEmail()).willReturn("hello@ittekimasu.app");
    given(token.getName()).willReturn("Arnold");
    given(firebaseAuth.verifyIdToken(VALID_TOKEN)).willReturn(token);
  }

  @Test
  void returnsCurrentUserForAValidToken() throws Exception {
    given(userService.findOrCreate(any())).willReturn(sampleUser());

    mockMvc
        .perform(get("/api/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(USER_ID.toString()))
        .andExpect(jsonPath("$.email").value("hello@ittekimasu.app"))
        .andExpect(jsonPath("$.displayName").value("Arnold"));
  }

  @Test
  void resolvesTheUserFromTheTokenRatherThanTheRequest() throws Exception {
    given(userService.findOrCreate(any())).willReturn(sampleUser());

    mockMvc.perform(
        get("/api/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN));

    ArgumentCaptor<FirebasePrincipal> captor = ArgumentCaptor.forClass(FirebasePrincipal.class);
    verify(userService).findOrCreate(captor.capture());
    org.assertj.core.api.Assertions.assertThat(captor.getValue().uid()).isEqualTo("firebase-uid-123");
  }

  @Test
  void rejectsARequestWithNoToken() throws Exception {
    mockMvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void rejectsAnUnverifiableToken() throws Exception {
    given(firebaseAuth.verifyIdToken("garbage"))
        .willThrow(new IllegalArgumentException("Failed to parse token"));

    mockMvc
        .perform(get("/api/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer garbage"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void deletesTheCallersAccount() throws Exception {
    mockMvc
        .perform(delete("/api/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN))
        .andExpect(status().isNoContent());

    verify(userService).deleteByFirebaseUid(eq("firebase-uid-123"));
  }

  @Test
  void reportsAFreeUsersDailyLimit() throws Exception {
    given(userService.findOrCreate(any())).willReturn(sampleUser());
    given(entitlementService.getEntitlement(eq(USER_ID), eq(20)))
        .willReturn(new EntitlementResponse(false, null, 20));

    mockMvc
        .perform(
            get("/api/users/me/entitlement")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.premium").value(false))
        .andExpect(jsonPath("$.dailyReviewLimit").value(20));
  }

  /** Premium reports a null limit, never a sentinel that could render as "-1 cards a day". */
  @Test
  void reportsPremiumAsUnlimited() throws Exception {
    given(userService.findOrCreate(any())).willReturn(sampleUser());
    given(entitlementService.getEntitlement(eq(USER_ID), eq(20)))
        .willReturn(
            new EntitlementResponse(true, Instant.parse("2027-08-20T00:00:00Z"), null));

    mockMvc
        .perform(
            get("/api/users/me/entitlement")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_TOKEN))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.premium").value(true))
        .andExpect(jsonPath("$.dailyReviewLimit").doesNotExist());
  }

  private User sampleUser() {
    User user = new User();
    user.setId(USER_ID);
    user.setFirebaseUid("firebase-uid-123");
    user.setEmail("hello@ittekimasu.app");
    user.setDisplayName("Arnold");
    user.setCreatedAt(Instant.parse("2026-08-20T00:00:00Z"));
    user.setUpdatedAt(Instant.parse("2026-08-20T00:00:00Z"));
    return user;
  }
}
