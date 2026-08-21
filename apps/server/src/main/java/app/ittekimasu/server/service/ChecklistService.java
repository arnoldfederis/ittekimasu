package app.ittekimasu.server.service;

import app.ittekimasu.server.dto.response.ChecklistTemplateDetailResponse;
import app.ittekimasu.server.dto.response.ChecklistTemplateSummaryResponse;
import app.ittekimasu.server.entity.VisaPurpose;
import app.ittekimasu.server.exception.ResourceNotFoundException;
import app.ittekimasu.server.repository.ChecklistTemplateRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistService {

  private final ChecklistTemplateRepository templateRepository;

  public ChecklistService(ChecklistTemplateRepository templateRepository) {
    this.templateRepository = templateRepository;
  }

  /**
   * Every template, including the unavailable ones — the onboarding picker deliberately shows
   * "coming soon" rows rather than hiding them.
   */
  @Transactional(readOnly = true)
  public List<ChecklistTemplateSummaryResponse> listTemplates(String purpose) {
    var templates =
        purpose == null || purpose.isBlank()
            ? templateRepository.findAllByOrderBySortOrderAsc()
            : templateRepository.findAllByPurposeOrderBySortOrderAsc(parsePurpose(purpose));

    return templates.stream().map(ChecklistTemplateSummaryResponse::from).toList();
  }

  @Transactional(readOnly = true)
  public ChecklistTemplateDetailResponse getTemplate(String visaType) {
    return templateRepository
        .findByVisaType(visaType.toUpperCase(Locale.ROOT))
        .map(ChecklistTemplateDetailResponse::from)
        .orElseThrow(() -> new ResourceNotFoundException("Checklist template", visaType));
  }

  private VisaPurpose parsePurpose(String purpose) {
    try {
      return VisaPurpose.valueOf(purpose.toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException ex) {
      // A bad query param is a client mistake, not a 500.
      throw new ResourceNotFoundException("Purpose", purpose);
    }
  }
}
