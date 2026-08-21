package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.ChecklistTask;
import java.util.UUID;

public record ChecklistTaskResponse(
    UUID id, String category, String title, int defaultDueOffsetDays) {

  public static ChecklistTaskResponse from(ChecklistTask task) {
    return new ChecklistTaskResponse(
        task.getId(),
        task.getCategory().name(),
        task.getTitle(),
        task.getDefaultDueOffsetDays());
  }
}
