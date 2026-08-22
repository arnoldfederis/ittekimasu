package app.ittekimasu.server.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.ittekimasu.server.config.SecurityConfig;
import app.ittekimasu.server.config.WebMvcConfig;
import app.ittekimasu.server.dto.response.ChecklistTaskResponse;
import app.ittekimasu.server.dto.response.ChecklistTemplateDetailResponse;
import app.ittekimasu.server.dto.response.ChecklistTemplateSummaryResponse;
import app.ittekimasu.server.exception.GlobalExceptionHandler;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.ForbiddenException;
import app.ittekimasu.server.exception.ResourceNotFoundException;
import app.ittekimasu.server.service.ChecklistService;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ChecklistController.class)
@Import({SecurityConfig.class, WebMvcConfig.class, GlobalExceptionHandler.class})
class ChecklistControllerTest {

  private static final String VALID_TOKEN = "valid-id-token";
  private static final String AUTH = "Bearer " + VALID_TOKEN;
  private static final UUID TEMPLATE_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

  @Autowired private MockMvc mockMvc;

  private static final UUID USER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
  private static final UUID TASK_ID = UUID.fromString("44444444-4444-4444-4444-444444444444");

  @MockitoBean private FirebaseAuth firebaseAuth;
  @MockitoBean private ChecklistService checklistService;
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
  void rejectsAChecklistRequestMissingItsMoveDate() throws Exception {
    mockMvc
        .perform(
            post("/api/users/me/checklist")
                .header(HttpHeaders.AUTHORIZATION, AUTH)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"templateId\":\"%s\"}".formatted(TEMPLATE_ID)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fieldErrors.targetMoveDate").exists());
  }

  @Test
  void rejectsATaskUpdateMissingItsCompletedFlag() throws Exception {
    mockMvc
        .perform(
            patch("/api/checklist-tasks/{id}", TASK_ID)
                .header(HttpHeaders.AUTHORIZATION, AUTH)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fieldErrors.completed").exists());
  }

  @Test
  void mapsAForeignTaskTo403NotFound() throws Exception {
    given(checklistService.setTaskCompletion(USER_ID, TASK_ID, true))
        .willThrow(new ForbiddenException("That task belongs to someone else."));

    mockMvc
        .perform(
            patch("/api/checklist-tasks/{id}", TASK_ID)
                .header(HttpHeaders.AUTHORIZATION, AUTH)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"completed\":true}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error").value("Forbidden"));
  }

  @Test
  void requiresAuthenticationToReadTheChecklist() throws Exception {
    mockMvc.perform(get("/api/users/me/checklist")).andExpect(status().isUnauthorized());
  }

  @Test
  void listsEveryTemplateIncludingComingSoonOnes() throws Exception {
    given(checklistService.listTemplates(null))
        .willReturn(List.of(engineerSummary(), comingSoonSummary()));

    mockMvc
        .perform(get("/api/templates").header(HttpHeaders.AUTHORIZATION, AUTH))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].visaType").value("ENGINEER_SPECIALIST"))
        .andExpect(jsonPath("$[0].japaneseName").value("技術・人文知識・国際業務"))
        .andExpect(jsonPath("$[0].available").value(true))
        // The picker relies on this staying in the payload rather than being filtered out.
        .andExpect(jsonPath("$[1].available").value(false));
  }

  @Test
  void passesThePurposeFilterThrough() throws Exception {
    given(checklistService.listTemplates("WORK")).willReturn(List.of(engineerSummary()));

    mockMvc
        .perform(get("/api/templates?purpose=WORK").header(HttpHeaders.AUTHORIZATION, AUTH))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));

    verify(checklistService).listTemplates(eq("WORK"));
  }

  @Test
  void returnsTemplateDetailWithItsTasks() throws Exception {
    given(checklistService.getTemplate("ENGINEER_SPECIALIST"))
        .willReturn(
            new ChecklistTemplateDetailResponse(
                TEMPLATE_ID,
                "ENGINEER_SPECIALIST",
                "JP",
                "WORK",
                "Engineer / Specialist in Humanities / International Services",
                "技術・人文知識・国際業務",
                "The usual route for a software engineer hired by a Japanese company.",
                true,
                List.of(
                    new ChecklistTaskResponse(
                        UUID.randomUUID(),
                        "VISA_IMMIGRATION",
                        "Register your address at the ward office within 14 days of moving in",
                        14))));

    mockMvc
        .perform(get("/api/templates/ENGINEER_SPECIALIST").header(HttpHeaders.AUTHORIZATION, AUTH))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tasks.length()").value(1))
        .andExpect(jsonPath("$.tasks[0].category").value("VISA_IMMIGRATION"))
        // Positive offsets are days AFTER arrival — the ward-office legal deadline.
        .andExpect(jsonPath("$.tasks[0].defaultDueOffsetDays").value(14));
  }

  @Test
  void returns404ForAnUnknownVisaType() throws Exception {
    given(checklistService.getTemplate("NOPE"))
        .willThrow(new ResourceNotFoundException("Checklist template", "NOPE"));

    mockMvc
        .perform(get("/api/templates/NOPE").header(HttpHeaders.AUTHORIZATION, AUTH))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error").value("Not Found"));
  }

  @Test
  void requiresAuthentication() throws Exception {
    mockMvc.perform(get("/api/templates")).andExpect(status().isUnauthorized());
  }

  private ChecklistTemplateSummaryResponse engineerSummary() {
    return new ChecklistTemplateSummaryResponse(
        TEMPLATE_ID,
        "ENGINEER_SPECIALIST",
        "JP",
        "WORK",
        "Engineer / Specialist in Humanities / International Services",
        "技術・人文知識・国際業務",
        "The usual route for a software engineer hired by a Japanese company.",
        true);
  }

  private ChecklistTemplateSummaryResponse comingSoonSummary() {
    return new ChecklistTemplateSummaryResponse(
        UUID.randomUUID(),
        "WORKING_HOLIDAY",
        "JP",
        "WORK",
        "Working Holiday",
        "ワーキングホリデー",
        "Up to a year of work and travel.",
        false);
  }
}
