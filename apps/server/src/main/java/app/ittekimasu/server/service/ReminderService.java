package app.ittekimasu.server.service;

import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.repository.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sends the daily study reminder.
 *
 * <p>Server-side rather than a OneSignal dashboard campaign. The dashboard route needs one
 * segment and one recurring campaign per hour offered, which does not scale past a handful
 * of times and made the app's time picker a hostage to how much clicking had been done. The
 * data — hour and timezone — was already here.
 */
@Service
public class ReminderService {

  private static final Logger log = LoggerFactory.getLogger(ReminderService.class);

  private static final String HEADING = "Time for today's Japanese";
  private static final String CONTENT = "A few cards is all it takes to keep your streak.";

  private final UserRepository userRepository;
  private final OneSignalClient oneSignal;

  public ReminderService(UserRepository userRepository, OneSignalClient oneSignal) {
    this.userRepository = userRepository;
    this.oneSignal = oneSignal;
  }

  /**
   * Whether this user should be reminded right now.
   *
   * <p>Static and clock-injected so the awkward parts — timezones, the once-a-day guard —
   * are testable without a database or a scheduler.
   */
  public static boolean isDue(User user, Instant now) {
    if (user.getReminderHour() == null) {
      return false;
    }

    ZoneId zone;
    try {
      // A bad or missing zone should not stop everyone else's reminders.
      zone =
          user.getReminderTimezone() == null
              ? ReviewService.APP_ZONE
              : ZoneId.of(user.getReminderTimezone());
    } catch (Exception ex) {
      zone = ReviewService.APP_ZONE;
    }

    ZonedDateTime local = now.atZone(zone);
    if (local.getHour() != user.getReminderHour()) {
      return false;
    }

    // The job runs every 15 minutes, so without this it would fire four times in the hour.
    LocalDate localDate = local.toLocalDate();
    return !localDate.equals(user.getLastRemindedOn());
  }

  /**
   * Runs every 15 minutes rather than hourly: a user's timezone can be offset by 30 or 45
   * minutes (India, Nepal, Chatham), and an hourly tick would drift against them.
   */
  @Scheduled(cron = "0 0,15,30,45 * * * *")
  @Transactional
  public void sendDueReminders() {
    if (!oneSignal.isConfigured()) {
      return;
    }

    Instant now = Instant.now();
    List<User> due =
        userRepository.findAllByReminderHourNotNull().stream()
            .filter(user -> isDue(user, now))
            .toList();

    if (due.isEmpty()) {
      return;
    }

    List<String> externalIds = due.stream().map(User::getFirebaseUid).toList();

    for (int start = 0; start < externalIds.size(); start += OneSignalClient.MAX_ALIASES_PER_REQUEST) {
      List<String> batch =
          externalIds.subList(
              start,
              Math.min(start + OneSignalClient.MAX_ALIASES_PER_REQUEST, externalIds.size()));
      oneSignal.send(batch, HEADING, CONTENT);
    }

    // Stamped whether or not the push succeeded. A failed send is not worth retrying on the
    // next tick — a reminder that lands an hour late is worse than one that never arrives.
    for (User user : due) {
      ZoneId zone =
          user.getReminderTimezone() == null
              ? ReviewService.APP_ZONE
              : ZoneId.of(user.getReminderTimezone());
      user.setLastRemindedOn(now.atZone(zone).toLocalDate());
    }

    log.info("Reminder tick: {} users due", due.size());
  }
}
