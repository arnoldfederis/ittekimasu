package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.ChecklistTemplate;
import java.util.List;
import java.util.UUID;

public record ChecklistTemplateDetailResponse(
    UUID id,
    String visaType,
    String country,
    String purpose,
    String displayName,
    String japaneseName,
    String description,
    boolean available,
    List<ChecklistTaskResponse> tasks) {

  public static ChecklistTemplateDetailResponse from(ChecklistTemplate template) {
    return new ChecklistTemplateDetailResponse(
        template.getId(),
        template.getVisaType(),
        template.getCountry(),
        template.getPurpose().name(),
        template.getDisplayName(),
        template.getJapaneseName(),
        template.getDescription(),
        template.isAvailable(),
        template.getTasks().stream().map(ChecklistTaskResponse::from).toList());
  }
}
