package app.ittekimasu.server.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.ittekimasu.server.entity.User;
import java.time.Instant;
import java.time.LocalDate;
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
}
