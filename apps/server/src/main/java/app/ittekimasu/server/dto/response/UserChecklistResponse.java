package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.ChecklistCategory;
import app.ittekimasu.server.entity.UserChecklistTask;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The whole checklist in one call: grouped for the checklist tab, counted for the dashboard
 * ring, and carrying the template name and move date so the dashboard needs no second round
 * trip.
 */
public record UserChecklistResponse(
    Map<String, List<UserChecklistTaskResponse>> tasksByCategory,
    int completedCount,
    int totalCount,
    String visaType,
    String templateDisplayName,
    LocalDate targetMoveDate) {

  public static UserChecklistResponse of(
      List<UserChecklistTask> userTasks,
      String visaType,
      String templateDisplayName,
      LocalDate targetMoveDate) {

    // LinkedHashMap keyed in enum declaration order so VISA_IMMIGRATION leads and the app
    // never has to re-sort the sections. Jackson preserves insertion order.
    Map<String, List<UserChecklistTaskResponse>> grouped = new LinkedHashMap<>();
    for (ChecklistCategory category : ChecklistCategory.values()) {
      List<UserChecklistTaskResponse> inCategory =
          userTasks.stream()
              .filter(userTask -> userTask.getTask().getCategory() == category)
              .map(UserChecklistTaskResponse::from)
              .toList();

      // Categories the user has no tasks in are omitted rather than sent as empty arrays.
      if (!inCategory.isEmpty()) {
        grouped.put(category.name(), inCategory);
      }
    }

    int completed = (int) userTasks.stream().filter(UserChecklistTask::isCompleted).count();

    return new UserChecklistResponse(
        grouped, completed, userTasks.size(), visaType, templateDisplayName, targetMoveDate);
  }
}
