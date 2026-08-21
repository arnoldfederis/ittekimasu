package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.ChecklistTemplate;
import java.util.UUID;

/**
 * List-view shape for the onboarding visa picker.
 *
 * <p>Carries the display strings so the app never hardcodes visa names — adding a template is
 * a migration, not a release. {@code available} is false for "coming soon" rows, which the
 * picker shows disabled rather than hiding.
 */
public record ChecklistTemplateSummaryResponse(
    UUID id,
    String visaType,
    String country,
    String purpose,
    String displayName,
    String japaneseName,
    String description,
    boolean available) {

  public static ChecklistTemplateSummaryResponse from(ChecklistTemplate template) {
    return new ChecklistTemplateSummaryResponse(
        template.getId(),
        template.getVisaType(),
        template.getCountry(),
        template.getPurpose().name(),
        template.getDisplayName(),
        template.getJapaneseName(),
        template.getDescription(),
        template.isAvailable());
  }
}
