package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.ittekimasu.server.entity.ChecklistCategory;
import app.ittekimasu.server.entity.ChecklistTask;
import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.entity.UserChecklistTask;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The timezone and once-a-day rules, with no database and no scheduler. */
class ReminderServiceTest {

  /** 2026-08-26T11:30Z — 20:30 in Tokyo, 19:30 in Manila, 12:30 in London. */
  private static final Instant NOW = Instant.parse("2026-08-26T11:30:00Z");

  private User user(Integer hour, String zone, LocalDate lastReminded) {
    User user = new User();
    user.setFirebaseUid("uid");
    user.setReminderHour(hour == null ? null : hour.shortValue());
    user.setReminderTimezone(zone);
    user.setLastRemindedOn(lastReminded);
    return user;
  }

  @Test
  void remindersOffMeansNeverDue() {
    assertThat(ReminderService.isDue(user(null, "Asia/Tokyo", null), NOW)).isFalse();
  }

  @Test
  void dueWhenTheLocalHourMatches() {
    assertThat(ReminderService.isDue(user(20, "Asia/Tokyo", null), NOW)).isTrue();
  }

  @Test
  void notDueWhenTheLocalHourDoesNotMatch() {
    assertThat(ReminderService.isDue(user(21, "Asia/Tokyo", null), NOW)).isFalse();
  }

  /** The whole point of storing a timezone: 8pm has to mean the user's 8pm. */
  @Test
  void theHourIsEvaluatedInTheUsersOwnTimezone() {
    // Same instant: 20:30 Tokyo, 19:30 Manila.
    assertThat(ReminderService.isDue(user(20, "Asia/Tokyo", null), NOW)).isTrue();
    assertThat(ReminderService.isDue(user(20, "Asia/Manila", null), NOW)).isFalse();
    assertThat(ReminderService.isDue(user(19, "Asia/Manila", null), NOW)).isTrue();
  }

  /** Half-hour offsets are why the job ticks every 15 minutes rather than hourly. */
  @Test
  void handlesAHalfHourOffsetZone() {
    // 11:30Z is 17:00 in Kolkata (+5:30).
    assertThat(ReminderService.isDue(user(17, "Asia/Kolkata", null), NOW)).isTrue();
  }

  @Test
  void notDueTwiceOnTheSameLocalDay() {
    LocalDate tokyoToday = LocalDate.of(2026, 8, 26);
    assertThat(ReminderService.isDue(user(20, "Asia/Tokyo", tokyoToday), NOW)).isFalse();
  }

  @Test
  void dueAgainTheFollowingDay() {
    LocalDate yesterday = LocalDate.of(2026, 8, 25);
    assertThat(ReminderService.isDue(user(20, "Asia/Tokyo", yesterday), NOW)).isTrue();
  }

  /** A stored zone can be garbage after a bad client write; it must not break everyone else. */
  @Test
  void fallsBackToTheAppZoneOnAnUnparseableTimezone() {
    assertThat(ReminderService.isDue(user(20, "Not/AZone", null), NOW)).isTrue();
  }

  @Test
  void fallsBackToTheAppZoneWhenNoTimezoneWasStored() {
    assertThat(ReminderService.isDue(user(20, null, null), NOW)).isTrue();
  }

  /** The stamping at the end of the tick uses this; it used to throw on a bad zone. */
  @Test
  void zoneOfNeverThrowsOnAnUnparseableTimezone() {
    assertThat(ReminderService.zoneOf(user(20, "Not/AZone", null)))
        .isEqualTo(ReviewService.APP_ZONE);
  }

  // --- The checklist deadline push ---

  private static final LocalDate TODAY = LocalDate.of(2026, 9, 29);

  private UserChecklistTask task(String title, LocalDate due, boolean completed) {
    return task(title, due, completed, ChecklistCategory.VISA_IMMIGRATION, 1);
  }

  private UserChecklistTask task(
      String title, LocalDate due, boolean completed, ChecklistCategory category, int sortOrder) {
    ChecklistTask template = new ChecklistTask();
    template.setTitle(title);
    template.setCategory(category);
    template.setSortOrder(sortOrder);
    UserChecklistTask task = new UserChecklistTask();
    task.setTask(template);
    task.setDueDate(due);
    task.setCompleted(completed);
    return task;
  }

  @Test
  void noChecklistPushWhenNothingFallsOnALeadDay() {
    List<UserChecklistTask> tasks =
        List.of(task("Book your flight", TODAY.plusDays(2), false), task("Today", TODAY, false));
    assertThat(ReminderService.checklistMessage(tasks, TODAY)).isEmpty();
  }

  @Test
  void announcesATaskDueTomorrow() {
    List<UserChecklistTask> tasks =
        List.of(task("Register your address at the ward office", TODAY.plusDays(1), false));
    assertThat(ReminderService.checklistMessage(tasks, TODAY))
        .contains(
            new ReminderService.Message(
                "Due tomorrow on your move checklist",
                "Register your address at the ward office"));
  }

  @Test
  void announcesATaskDueInThreeDays() {
    List<UserChecklistTask> tasks = List.of(task("Book your flight", TODAY.plusDays(3), false));
    assertThat(ReminderService.checklistMessage(tasks, TODAY))
        .contains(
            new ReminderService.Message(
                "Due in 3 days on your move checklist", "Book your flight"));
  }

  /** Tomorrow is the more urgent warning, so it wins over one three days out. */
  @Test
  void theNearestDeadlineWins() {
    List<UserChecklistTask> tasks =
        List.of(
            task("Three days out", TODAY.plusDays(3), false),
            task("Tomorrow", TODAY.plusDays(1), false));
    assertThat(ReminderService.checklistMessage(tasks, TODAY))
        .map(ReminderService.Message::content)
        .contains("Tomorrow");
  }

  /**
   * Day 14 holds both the address registration and health insurance. Every task is named on
   * its own line — "and 1 more" hid a real deadline behind a count.
   */
  @Test
  void listsEveryTaskDueTheSameDayOnItsOwnLine() {
    LocalDate day = TODAY.plusDays(1);
    List<UserChecklistTask> tasks =
        List.of(
            task("Register your address", day, false),
            task("Enroll in health insurance", day, false),
            task("Apply for your My Number card", day, false));
    assertThat(ReminderService.checklistMessage(tasks, TODAY))
        .contains(
            new ReminderService.Message(
                "3 tasks due tomorrow on your move checklist",
                """
                • Register your address
                • Enroll in health insurance
                • Apply for your My Number card\
                """));
  }

  @Test
  void listsAtMostThreeAndCountsTheRest() {
    LocalDate day = TODAY.plusDays(1);
    List<UserChecklistTask> tasks =
        List.of(
            task("One", day, false, ChecklistCategory.VISA_IMMIGRATION, 1),
            task("Two", day, false, ChecklistCategory.VISA_IMMIGRATION, 2),
            task("Three", day, false, ChecklistCategory.VISA_IMMIGRATION, 3),
            task("Four", day, false, ChecklistCategory.VISA_IMMIGRATION, 4),
            task("Five", day, false, ChecklistCategory.VISA_IMMIGRATION, 5));
    assertThat(ReminderService.checklistMessage(tasks, TODAY))
        .contains(
            new ReminderService.Message(
                "5 tasks due tomorrow on your move checklist",
                """
                • One
                • Two
                • Three
                +2 more\
                """));
  }

  /**
   * sortOrder restarts inside each category, so on its own it would headline health insurance
   * (WORK_ADMIN #1) over the address registration (VISA_IMMIGRATION #8) it depends on.
   */
  @Test
  void theHeadlineTaskIsChosenByCategoryBeforeSortOrder() {
    LocalDate day = TODAY.plusDays(1);
    List<UserChecklistTask> tasks =
        List.of(
            task("Enroll in health insurance", day, false, ChecklistCategory.WORK_ADMIN, 1),
            task("Register your address", day, false, ChecklistCategory.VISA_IMMIGRATION, 8));
    assertThat(ReminderService.checklistMessage(tasks, TODAY))
        .map(ReminderService.Message::content)
        .contains("• Register your address\n• Enroll in health insurance");
  }

  @Test
  void aTaskAlreadyTickedOffIsNeverAnnounced() {
    List<UserChecklistTask> tasks = List.of(task("Done already", TODAY.plusDays(1), true));
    assertThat(ReminderService.checklistMessage(tasks, TODAY)).isEmpty();
  }
}
