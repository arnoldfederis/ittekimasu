package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.ittekimasu.server.dto.request.CreateChecklistRequest;
import app.ittekimasu.server.dto.response.UserChecklistResponse;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.exception.ForbiddenException;
import app.ittekimasu.server.repository.ChecklistTemplateRepository;
import app.ittekimasu.server.repository.UserRepository;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Exercises the real seeded template against a real database — the due-date arithmetic is the
 * one piece of logic here that a mocked test would not actually prove.
 *
 * <p>Needs Postgres running (`devbox run dev up`).
 */
@SpringBootTest
@Transactional
class ChecklistServiceIntegrationTest {

  private static final LocalDate MOVE_DATE = LocalDate.of(2026, 10, 1);

  @Autowired private ChecklistService checklistService;
  @Autowired private ChecklistTemplateRepository templateRepository;
  @Autowired private UserRepository userRepository;

  private User user;
  private UUID engineerTemplateId;

  @BeforeEach
  void setUp() {
    user = new User();
    user.setFirebaseUid("test-uid-" + UUID.randomUUID());
    user.setEmail("checklist-test@ittekimasu.app");
    user.setDisplayName("Test");
    user = userRepository.save(user);

    engineerTemplateId =
        templateRepository.findByVisaType("ENGINEER_SPECIALIST").orElseThrow().getId();
  }

  @Test
  void copiesEveryTemplateTaskAndResolvesDueDatesFromTheMoveDate() {
    UserChecklistResponse response =
        checklistService.createChecklist(
            user.getId(), new CreateChecklistRequest(engineerTemplateId, MOVE_DATE));

    assertThat(response.totalCount()).isEqualTo(27);
    assertThat(response.completedCount()).isZero();
    assertThat(response.visaType()).isEqualTo("ENGINEER_SPECIALIST");
    assertThat(response.targetMoveDate()).isEqualTo(MOVE_DATE);

    // Sections arrive in enum order so the app never re-sorts them.
    assertThat(response.tasksByCategory().keySet())
        .containsExactly(
            "VISA_IMMIGRATION",
            "HOUSING",
            "BANKING_MONEY",
            "WORK_ADMIN",
            "LANGUAGE",
            "LOGISTICS");

    var immigration = response.tasksByCategory().get("VISA_IMMIGRATION");

    // The legal deadline: 14 days AFTER arrival.
    var wardOffice =
        immigration.stream()
            .filter(task -> task.title().contains("ward office"))
            .findFirst()
            .orElseThrow();
    assertThat(wardOffice.dueDate()).isEqualTo(MOVE_DATE.plusDays(14));

    // The earliest task: 120 days BEFORE the move.
    var coe =
        immigration.stream()
            .filter(task -> task.title().contains("sponsor"))
            .findFirst()
            .orElseThrow();
    assertThat(coe.dueDate()).isEqualTo(MOVE_DATE.minusDays(120));
  }

  @Test
  void reAdoptingATemplateReplacesRatherThanDuplicating() {
    var request = new CreateChecklistRequest(engineerTemplateId, MOVE_DATE);
    checklistService.createChecklist(user.getId(), request);
    checklistService.createChecklist(user.getId(), request);

    // Would be 54, or a unique-constraint violation, if the wipe-first were missing.
    assertThat(checklistService.getChecklist(user.getId(), null).totalCount()).isEqualTo(27);
  }

  @Test
  void changingTheMoveDateShiftsEveryDueDate() {
    checklistService.createChecklist(
        user.getId(), new CreateChecklistRequest(engineerTemplateId, MOVE_DATE));
    checklistService.createChecklist(
        user.getId(), new CreateChecklistRequest(engineerTemplateId, MOVE_DATE.plusMonths(1)));

    var wardOffice =
        checklistService.getChecklist(user.getId(), "VISA_IMMIGRATION").tasksByCategory()
            .get("VISA_IMMIGRATION").stream()
            .filter(task -> task.title().contains("ward office"))
            .findFirst()
            .orElseThrow();

    assertThat(wardOffice.dueDate()).isEqualTo(MOVE_DATE.plusMonths(1).plusDays(14));
  }

  @Test
  void filtersByCategory() {
    checklistService.createChecklist(
        user.getId(), new CreateChecklistRequest(engineerTemplateId, MOVE_DATE));

    var housing = checklistService.getChecklist(user.getId(), "HOUSING");

    assertThat(housing.tasksByCategory()).containsOnlyKeys("HOUSING");
    // totalCount reflects the filtered set, which is what the section header counts.
    assertThat(housing.totalCount()).isEqualTo(5);
  }

  @Test
  void togglingCompletionUpdatesTheCount() {
    var created =
        checklistService.createChecklist(
            user.getId(), new CreateChecklistRequest(engineerTemplateId, MOVE_DATE));
    var first = created.tasksByCategory().get("VISA_IMMIGRATION").getFirst();

    var updated = checklistService.setTaskCompletion(user.getId(), first.id(), true);
    assertThat(updated.completed()).isTrue();

    assertThat(checklistService.getChecklist(user.getId(), null).completedCount()).isEqualTo(1);

    checklistService.setTaskCompletion(user.getId(), first.id(), false);
    assertThat(checklistService.getChecklist(user.getId(), null).completedCount()).isZero();
  }

  @Test
  void refusesToToggleSomeoneElsesTask() {
    var created =
        checklistService.createChecklist(
            user.getId(), new CreateChecklistRequest(engineerTemplateId, MOVE_DATE));
    var victimTaskId = created.tasksByCategory().get("VISA_IMMIGRATION").getFirst().id();

    var attacker = new User();
    attacker.setFirebaseUid("attacker-" + UUID.randomUUID());
    attacker.setEmail("attacker@example.com");
    var attackerId = userRepository.save(attacker).getId();

    assertThatThrownBy(
            () -> checklistService.setTaskCompletion(attackerId, victimTaskId, true))
        .isInstanceOf(ForbiddenException.class);
  }
}
