package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.request.CreateChecklistRequest;
import app.ittekimasu.server.dto.request.UpdateChecklistTaskRequest;
import app.ittekimasu.server.dto.response.ChecklistTemplateDetailResponse;
import app.ittekimasu.server.dto.response.ChecklistTemplateSummaryResponse;
import app.ittekimasu.server.dto.response.UserChecklistResponse;
import app.ittekimasu.server.dto.response.UserChecklistTaskResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.ChecklistService;
import app.ittekimasu.server.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Serves both the reference templates and the caller's own checklist. Routes are declared
 * without the /api prefix — WebMvcConfig adds it.
 */
@RestController
public class ChecklistController {

  private final ChecklistService checklistService;
  private final UserService userService;

  public ChecklistController(ChecklistService checklistService, UserService userService) {
    this.checklistService = checklistService;
    this.userService = userService;
  }

  /** @param purpose optional WORK / STUDY / FAMILY / OTHER filter, set by the purpose screen. */
  @GetMapping("/templates")
  public List<ChecklistTemplateSummaryResponse> listTemplates(
      @RequestParam(required = false) String purpose) {
    return checklistService.listTemplates(purpose);
  }

  @GetMapping("/templates/{visaType}")
  public ChecklistTemplateDetailResponse getTemplate(@PathVariable String visaType) {
    return checklistService.getTemplate(visaType);
  }

  /** Adopts a template. Re-running replaces the previous checklist. */
  @PostMapping("/users/me/checklist")
  public UserChecklistResponse createChecklist(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @Valid @RequestBody CreateChecklistRequest request) {
    return checklistService.createChecklist(userService.findOrCreate(principal).getId(), request);
  }

  @GetMapping("/users/me/checklist")
  public UserChecklistResponse getChecklist(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @RequestParam(required = false) String category) {
    return checklistService.getChecklist(userService.findOrCreate(principal).getId(), category);
  }

  /** 403, not 404, when the task is someone else's — see ChecklistService. */
  @PatchMapping("/checklist-tasks/{taskId}")
  public UserChecklistTaskResponse updateTask(
      @AuthenticationPrincipal FirebasePrincipal principal,
      @PathVariable UUID taskId,
      @Valid @RequestBody UpdateChecklistTaskRequest request) {
    return checklistService.setTaskCompletion(
        userService.findOrCreate(principal).getId(), taskId, request.completed());
  }
}
