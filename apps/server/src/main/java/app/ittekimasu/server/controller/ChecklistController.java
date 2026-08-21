package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.response.ChecklistTemplateDetailResponse;
import app.ittekimasu.server.dto.response.ChecklistTemplateSummaryResponse;
import app.ittekimasu.server.service.ChecklistService;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/templates")
public class ChecklistController {

  private final ChecklistService checklistService;

  public ChecklistController(ChecklistService checklistService) {
    this.checklistService = checklistService;
  }

  /** @param purpose optional WORK / STUDY / FAMILY / OTHER filter, set by the purpose screen. */
  @GetMapping
  public List<ChecklistTemplateSummaryResponse> listTemplates(
      @RequestParam(required = false) String purpose) {
    return checklistService.listTemplates(purpose);
  }

  @GetMapping("/{visaType}")
  public ChecklistTemplateDetailResponse getTemplate(@PathVariable String visaType) {
    return checklistService.getTemplate(visaType);
  }
}
