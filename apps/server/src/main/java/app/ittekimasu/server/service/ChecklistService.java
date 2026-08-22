package app.ittekimasu.server.service;

import app.ittekimasu.server.dto.request.CreateChecklistRequest;
import app.ittekimasu.server.dto.response.ChecklistTemplateDetailResponse;
import app.ittekimasu.server.dto.response.ChecklistTemplateSummaryResponse;
import app.ittekimasu.server.dto.response.UserChecklistResponse;
import app.ittekimasu.server.dto.response.UserChecklistTaskResponse;
import app.ittekimasu.server.entity.ChecklistCategory;
import app.ittekimasu.server.entity.ChecklistTemplate;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.entity.UserChecklistTask;
import app.ittekimasu.server.entity.VisaPurpose;
import app.ittekimasu.server.exception.BadRequestException;
import app.ittekimasu.server.exception.ForbiddenException;
import app.ittekimasu.server.exception.ResourceNotFoundException;
import app.ittekimasu.server.repository.ChecklistTemplateRepository;
import app.ittekimasu.server.repository.UserChecklistTaskRepository;
import app.ittekimasu.server.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistService {

  private final ChecklistTemplateRepository templateRepository;
  private final UserChecklistTaskRepository userTaskRepository;
  private final UserRepository userRepository;

  public ChecklistService(
      ChecklistTemplateRepository templateRepository,
      UserChecklistTaskRepository userTaskRepository,
      UserRepository userRepository) {
    this.templateRepository = templateRepository;
    this.userTaskRepository = userTaskRepository;
    this.userRepository = userRepository;
  }

  /**
   * Loads the user inside the caller's transaction. UserService.findOrCreate returns a
   * DETACHED entity, so mutating it here would silently never flush, and touching its lazy
   * checklistTemplate would throw with open-in-view off.
   */
  private User managedUser(UUID userId) {
    return userRepository
        .findById(userId)
        .orElseThrow(() -> new ResourceNotFoundException("User", userId));
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

  /**
   * Adopts a template: copies every task and resolves each due date against the move date.
   *
   * <p>Idempotent — re-running wipes the previous copy first, so a user who redoes onboarding
   * gets a clean checklist rather than a unique-constraint violation. That does discard
   * completion state, which is the right trade for "I picked the wrong visa".
   */
  @Transactional
  public UserChecklistResponse createChecklist(UUID userId, CreateChecklistRequest request) {
    User user = managedUser(userId);
    ChecklistTemplate template =
        templateRepository
            .findById(request.templateId())
            .orElseThrow(
                () -> new ResourceNotFoundException("Checklist template", request.templateId()));

    if (!template.isAvailable()) {
      throw new BadRequestException(
          "%s has no tasks yet. Pick an available visa route.".formatted(template.getVisaType()));
    }

    userTaskRepository.deleteAllByUserId(user.getId());
    // Flush the deletes before the inserts, or the unique (user_id, task_id) constraint
    // trips when Hibernate reorders them.
    userTaskRepository.flush();

    List<UserChecklistTask> copies =
        template.getTasks().stream()
            .map(
                task -> {
                  var copy = new UserChecklistTask();
                  copy.setUser(user);
                  copy.setTask(task);
                  copy.setCompleted(false);
                  copy.setDueDate(
                      request.targetMoveDate().plusDays(task.getDefaultDueOffsetDays()));
                  return copy;
                })
            .toList();

    userTaskRepository.saveAll(copies);

    user.setTargetMoveDate(request.targetMoveDate());
    user.setChecklistTemplate(template);

    return UserChecklistResponse.of(
        copies, template.getVisaType(), template.getDisplayName(), request.targetMoveDate());
  }

  @Transactional(readOnly = true)
  public UserChecklistResponse getChecklist(UUID userId, String category) {
    User user = managedUser(userId);
    List<UserChecklistTask> tasks =
        category == null || category.isBlank()
            ? userTaskRepository.findAllForUser(user.getId())
            : userTaskRepository.findAllForUserByCategory(user.getId(), parseCategory(category));

    ChecklistTemplate template = user.getChecklistTemplate();
    return UserChecklistResponse.of(
        tasks,
        template == null ? null : template.getVisaType(),
        template == null ? null : template.getDisplayName(),
        user.getTargetMoveDate());
  }

  @Transactional
  public UserChecklistTaskResponse setTaskCompletion(
      UUID userId, UUID userTaskId, boolean completed) {
    UserChecklistTask userTask =
        userTaskRepository
            .findById(userTaskId)
            .orElseThrow(() -> new ResourceNotFoundException("Checklist task", userTaskId));

    // Never 404 here — that would leak whether the id exists at all.
    if (!userTask.getUser().getId().equals(userId)) {
      throw new ForbiddenException("That task belongs to someone else.");
    }

    userTask.setCompleted(completed);
    userTask.setCompletedAt(completed ? Instant.now() : null);

    return UserChecklistTaskResponse.from(userTask);
  }

  private ChecklistCategory parseCategory(String category) {
    try {
      return ChecklistCategory.valueOf(category.toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException ex) {
      throw new BadRequestException("Unknown category: " + category);
    }
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
