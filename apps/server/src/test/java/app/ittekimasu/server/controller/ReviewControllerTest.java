package app.ittekimasu.server.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.ittekimasu.server.config.SecurityConfig;
import app.ittekimasu.server.config.WebMvcConfig;
import app.ittekimasu.server.dto.response.ReviewResultResponse;
import app.ittekimasu.server.entity.ReviewRating;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.GlobalExceptionHandler;
import app.ittekimasu.server.exception.PaymentRequiredException;
import app.ittekimasu.server.service.ReviewService;
import app.ittekimasu.server.service.UserService;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ReviewController.class)
@Import({SecurityConfig.class, WebMvcConfig.class, GlobalExceptionHandler.class})
class ReviewControllerTest {

  private static final String VALID_TOKEN = "valid-id-token";
  private static final String AUTH = "Bearer " + VALID_TOKEN;
  private static final UUID USER_ID = UUID.fromString("77777777-7777-7777-7777-777777777777");
  private static final UUID CARD_ID = UUID.fromString("88888888-8888-8888-8888-888888888888");

  @Autowired private MockMvc mockMvc;

  @MockitoBean private FirebaseAuth firebaseAuth;
  @MockitoBean private ReviewService reviewService;
  @MockitoBean private UserService userService;

  @BeforeEach
  void stubFirebase() throws Exception {
    FirebaseToken token = org.mockito.Mockito.mock(FirebaseToken.class);
    given(token.getUid()).willReturn("firebase-uid-123");
    given(firebaseAuth.verifyIdToken(VALID_TOKEN)).willReturn(token);

    User user = new User();
    user.setId(USER_ID);
    given(userService.findOrCreate(org.mockito.ArgumentMatchers.any())).willReturn(user);
  }

  @Test
  void returnsTheNewScheduleForTheCard() throws Exception {
    given(reviewService.submitReview(USER_ID, CARD_ID, ReviewRating.GOOD))
        .willReturn(
            new ReviewResultResponse(
                CARD_ID,
                "GOOD",
                6,
                LocalDate.of(2026, 9, 4),
                2.5,
                1,
                4,
                9,
                19));

    mockMvc
        .perform(
            post("/api/reviews/%s".formatted(CARD_ID))
                .header(HttpHeaders.AUTHORIZATION, AUTH)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":\"GOOD\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intervalDays").value(6))
        .andExpect(jsonPath("$.nextReviewDate").value("2026-09-04"))
        .andExpect(jsonPath("$.studyStreakDays").value(4))
        .andExpect(jsonPath("$.reviewsRemainingToday").value(19));
  }

  @Test
  void rejectsAReviewWithNoRating() throws Exception {
    mockMvc
        .perform(
            post("/api/reviews/%s".formatted(CARD_ID))
                .header(HttpHeaders.AUTHORIZATION, AUTH)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fieldErrors.rating").exists());
  }

  /** The free daily cap is a paywall trigger, so it must surface as 402. */
  @Test
  void answersAnExhaustedDailyAllowanceWith402() throws Exception {
    given(reviewService.submitReview(USER_ID, CARD_ID, ReviewRating.EASY))
        .willThrow(new PaymentRequiredException("That's 20 reviews today."));

    mockMvc
        .perform(
            post("/api/reviews/%s".formatted(CARD_ID))
                .header(HttpHeaders.AUTHORIZATION, AUTH)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":\"EASY\"}"))
        .andExpect(status().isPaymentRequired())
        .andExpect(jsonPath("$.status").value(402));
  }

  @Test
  void requiresAuthentication() throws Exception {
    mockMvc
        .perform(
            post("/api/reviews/%s".formatted(CARD_ID))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":\"GOOD\"}"))
        .andExpect(status().isUnauthorized());
  }
}
