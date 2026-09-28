package app.ittekimasu.server.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.ittekimasu.server.config.SecurityConfig;
import app.ittekimasu.server.config.WebMvcConfig;
import app.ittekimasu.server.dto.request.KanaProgressItemRequest;
import app.ittekimasu.server.dto.response.KanaProgressResponse;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.PaymentRequiredException;
import app.ittekimasu.server.service.KanaProgressService;
import app.ittekimasu.server.service.UserService;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The HTTP contract of the kana backup: the route, request validation, and the 402 the client
 * reads as "this is Pro". The merge rule itself is proven against Postgres in
 * KanaProgressServiceIntegrationTest.
 */
@WebMvcTest(KanaProgressController.class)
@Import({SecurityConfig.class, WebMvcConfig.class})
class KanaProgressControllerTest {

  private static final String VALID_TOKEN = "valid-id-token";
  private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

  @Autowired private MockMvc mockMvc;

  @MockitoBean private FirebaseAuth firebaseAuth;
  @MockitoBean private UserService userService;
  @MockitoBean private KanaProgressService kanaProgressService;

  @BeforeEach
  void stubFirebaseAndUser() throws Exception {
    FirebaseToken token = org.mockito.Mockito.mock(FirebaseToken.class);
    given(token.getUid()).willReturn("firebase-uid-123");
    given(token.getEmail()).willReturn("hello@ittekimasu.app");
    given(firebaseAuth.verifyIdToken(VALID_TOKEN)).willReturn(token);

    User user = new User();
    user.setId(USER_ID);
    user.setFirebaseUid("firebase-uid-123");
    given(userService.findOrCreate(any())).willReturn(user);
  }

  @Test
  void returnsTheBackupForAProUser() throws Exception {
    given(kanaProgressService.list(USER_ID))
        .willReturn(List.of(new KanaProgressResponse("ぢゃ", 3, 4, 5200)));

    mockMvc
        .perform(get("/api/users/me/kana-progress").header(HttpHeaders.AUTHORIZATION, bearer()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].glyph").value("ぢゃ"))
        .andExpect(jsonPath("$[0].correct").value(3))
        .andExpect(jsonPath("$[0].attempts").value(4))
        .andExpect(jsonPath("$[0].totalMs").value(5200));
  }

  @Test
  void answers402OnTheFreePlan() throws Exception {
    given(kanaProgressService.list(USER_ID))
        .willThrow(new PaymentRequiredException("Backing up kana progress is part of Pro."));

    mockMvc
        .perform(get("/api/users/me/kana-progress").header(HttpHeaders.AUTHORIZATION, bearer()))
        .andExpect(status().isPaymentRequired());
  }

  @Test
  void passesTheSnapshotToTheServiceForTheSignedInUser() throws Exception {
    given(kanaProgressService.sync(eq(USER_ID), anyList()))
        .willReturn(List.of(new KanaProgressResponse("あ", 2, 2, 1800)));

    mockMvc
        .perform(
            patch("/api/users/me/kana-progress")
                .header(HttpHeaders.AUTHORIZATION, bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"items": [
                      {"glyph": "あ", "correct": 2, "attempts": 2, "totalMs": 1800},
                      {"glyph": "ヂャ", "correct": 0, "attempts": 1, "totalMs": 4100}
                    ]}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].glyph").value("あ"));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<KanaProgressItemRequest>> items = ArgumentCaptor.forClass(List.class);
    verify(kanaProgressService).sync(eq(USER_ID), items.capture());
    assertThat(items.getValue())
        .extracting(KanaProgressItemRequest::glyph)
        .containsExactly("あ", "ヂャ");
  }

  @Test
  void rejectsAGlyphThatIsNotKana() throws Exception {
    mockMvc
        .perform(
            patch("/api/users/me/kana-progress")
                .header(HttpHeaders.AUTHORIZATION, bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"items": [{"glyph": "abc", "correct": 1, "attempts": 1, "totalMs": 900}]}
                    """))
        .andExpect(status().isBadRequest());

    verify(kanaProgressService, never()).sync(any(), anyList());
  }

  @Test
  void rejectsMoreCorrectAnswersThanAttempts() throws Exception {
    mockMvc
        .perform(
            patch("/api/users/me/kana-progress")
                .header(HttpHeaders.AUTHORIZATION, bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"items": [{"glyph": "か", "correct": 5, "attempts": 2, "totalMs": 900}]}
                    """))
        .andExpect(status().isBadRequest());

    verify(kanaProgressService, never()).sync(any(), anyList());
  }

  @Test
  void requiresSignIn() throws Exception {
    mockMvc.perform(get("/api/users/me/kana-progress")).andExpect(status().isUnauthorized());
  }

  private static String bearer() {
    return "Bearer " + VALID_TOKEN;
  }
}
