package app.ittekimasu.server.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.ittekimasu.server.config.SecurityConfig;
import app.ittekimasu.server.config.WebMvcConfig;
import app.ittekimasu.server.dto.response.CardDueResponse;
import app.ittekimasu.server.dto.response.CourseSummaryResponse;
import app.ittekimasu.server.dto.response.DueCardsResponse;
import app.ittekimasu.server.dto.response.IntervalPreviewResponse;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.GlobalExceptionHandler;
import app.ittekimasu.server.exception.PaymentRequiredException;
import app.ittekimasu.server.service.CourseService;
import app.ittekimasu.server.service.ReviewService;
import app.ittekimasu.server.service.UserService;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CourseController.class)
@Import({SecurityConfig.class, WebMvcConfig.class, GlobalExceptionHandler.class})
class CourseControllerTest {

  private static final String VALID_TOKEN = "valid-id-token";
  private static final String AUTH = "Bearer " + VALID_TOKEN;
  private static final UUID USER_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");
  private static final UUID COURSE_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");

  @Autowired private MockMvc mockMvc;

  @MockitoBean private FirebaseAuth firebaseAuth;
  @MockitoBean private CourseService courseService;
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
  void listsFreeAndPremiumCoursesTogether() throws Exception {
    given(courseService.listCourses(null)).willReturn(List.of(n5(), premiumN4()));

    mockMvc
        .perform(get("/api/courses").header(HttpHeaders.AUTHORIZATION, AUTH))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].level").value("N5"))
        .andExpect(jsonPath("$[0].isPremium").value(false))
        .andExpect(jsonPath("$[0].cardCount").value(100))
        // The learn tab dims locked decks rather than filtering them out, so they must ship
        // in the payload.
        .andExpect(jsonPath("$[1].isPremium").value(true));
  }

  @Test
  void passesTheTopicFilterThrough() throws Exception {
    given(courseService.listCourses("JLPT")).willReturn(List.of(n5()));

    mockMvc
        .perform(get("/api/courses?topic=JLPT").header(HttpHeaders.AUTHORIZATION, AUTH))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));

    verify(courseService).listCourses(eq("JLPT"));
  }

  @Test
  void requiresAuthentication() throws Exception {
    mockMvc.perform(get("/api/courses")).andExpect(status().isUnauthorized());
  }

  @Test
  void returnsASessionWithTheIntervalPreviewsForEachCard() throws Exception {
    given(reviewService.listDue(USER_ID, COURSE_ID))
        .willReturn(
            new DueCardsResponse(
                COURSE_ID,
                "JLPT N5 Vocabulary",
                List.of(
                    new CardDueResponse(
                        UUID.randomUUID(),
                        "水",
                        "みず · water",
                        "VOCAB",
                        false,
                        new IntervalPreviewResponse(1, 6, 6, 6))),
                12,
                100,
                20,
                19,
                3));

    mockMvc
        .perform(
            get("/api/courses/%s/due".formatted(COURSE_ID)).header(HttpHeaders.AUTHORIZATION, AUTH))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.cards.length()").value(1))
        .andExpect(jsonPath("$.cards[0].seen").value(false))
        .andExpect(jsonPath("$.cards[0].intervals.good").value(6))
        .andExpect(jsonPath("$.reviewsRemainingToday").value(19))
        .andExpect(jsonPath("$.studyStreakDays").value(3));
  }

  /** 402, not 403 — the client opens the paywall on this status. */
  @Test
  void answersALockedDeckWith402() throws Exception {
    given(reviewService.listDue(USER_ID, COURSE_ID))
        .willThrow(new PaymentRequiredException("JLPT N4 Vocabulary is a premium deck."));

    mockMvc
        .perform(
            get("/api/courses/%s/due".formatted(COURSE_ID)).header(HttpHeaders.AUTHORIZATION, AUTH))
        .andExpect(status().isPaymentRequired())
        .andExpect(jsonPath("$.status").value(402));
  }

  private CourseSummaryResponse n5() {
    return new CourseSummaryResponse(
        UUID.randomUUID(), "JLPT N5 Vocabulary", "JLPT", "N5", "The first 100 words.", false, 100);
  }

  private CourseSummaryResponse premiumN4() {
    return new CourseSummaryResponse(
        UUID.randomUUID(), "JLPT N4 Vocabulary", "JLPT", "N4", "The next step up.", true, 0);
  }
}
