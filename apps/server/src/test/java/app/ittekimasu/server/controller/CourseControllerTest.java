package app.ittekimasu.server.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.ittekimasu.server.config.SecurityConfig;
import app.ittekimasu.server.config.WebMvcConfig;
import app.ittekimasu.server.dto.response.CourseSummaryResponse;
import app.ittekimasu.server.exception.GlobalExceptionHandler;
import app.ittekimasu.server.service.CourseService;
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

  @Autowired private MockMvc mockMvc;

  @MockitoBean private FirebaseAuth firebaseAuth;
  @MockitoBean private CourseService courseService;

  @BeforeEach
  void stubFirebase() throws Exception {
    FirebaseToken token = org.mockito.Mockito.mock(FirebaseToken.class);
    given(token.getUid()).willReturn("firebase-uid-123");
    given(firebaseAuth.verifyIdToken(VALID_TOKEN)).willReturn(token);
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

  private CourseSummaryResponse n5() {
    return new CourseSummaryResponse(
        UUID.randomUUID(), "JLPT N5 Vocabulary", "JLPT", "N5", "The first 100 words.", false, 100);
  }

  private CourseSummaryResponse premiumN4() {
    return new CourseSummaryResponse(
        UUID.randomUUID(), "JLPT N4 Vocabulary", "JLPT", "N4", "The next step up.", true, 0);
  }
}
