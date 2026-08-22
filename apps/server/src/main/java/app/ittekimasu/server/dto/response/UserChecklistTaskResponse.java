package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.UserChecklistTask;
import java.time.LocalDate;
import java.util.UUID;

public record UserChecklistTaskResponse(
    UUID id,
    String title,
    String category,
    boolean completed,
    LocalDate dueDate,
    /** Negative means the task is due before the move. Lets the app flag hard deadlines. */
    int defaultDueOffsetDays) {

  public static UserChecklistTaskResponse from(UserChecklistTask userTask) {
    var task = userTask.getTask();
    return new UserChecklistTaskResponse(
        userTask.getId(),
        task.getTitle(),
        task.getCategory().name(),
        userTask.isCompleted(),
        userTask.getDueDate(),
        task.getDefaultDueOffsetDays());
  }
}
