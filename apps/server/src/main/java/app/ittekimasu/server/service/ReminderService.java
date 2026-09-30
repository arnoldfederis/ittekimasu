package app.ittekimasu.server.service;

import app.ittekimasu.server.entity.User;
import app.ittekimasu.server.entity.UserChecklistTask;
import app.ittekimasu.server.repository.UserChecklistTaskRepository;
import app.ittekimasu.server.repository.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sends the daily reminder: a checklist deadline when one is close, the study nudge otherwise.
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

  /**
   * How far ahead a checklist task is announced. Tomorrow is the last useful warning at an
   * evening hour; three days is enough to book the appointment or chase HR. Fixed offsets
   * rather than "anything within a week" so each task is announced at most twice without a
   * column to remember that it already was.
   */
  static final List<Integer> CHECKLIST_LEAD_DAYS = List.of(1, 3);

  /** Tasks named in one push before the rest are counted as "+N more". */
  static final int MAX_LISTED_TASKS = 3;

  /** What one push says. Identical messages are batched into a single OneSignal request. */
  record Message(String heading, String content) {}

  private final UserRepository userRepository;
  private final UserChecklistTaskRepository checklistTaskRepository;
  private final OneSignalClient oneSignal;
  private final ReviewService reviewService;

  public ReminderService(
      UserRepository userRepository,
      UserChecklistTaskRepository checklistTaskRepository,
      OneSignalClient oneSignal,
      ReviewService reviewService) {
    this.userRepository = userRepository;
    this.checklistTaskRepository = checklistTaskRepository;
    this.oneSignal = oneSignal;
    this.reviewService = reviewService;
  }

  /**
   * The zone the user's reminder hour is expressed in. A bad or missing zone falls back to
   * the app zone rather than throwing: one unparseable row must not stop everyone else's
   * reminders — and it used to, because only {@link #isDue} guarded it and the stamping at
   * the end of the tick called {@code ZoneId.of} directly.
   */
  static ZoneId zoneOf(User user) {
    try {
      return user.getReminderTimezone() == null
          ? ReviewService.APP_ZONE
          : ZoneId.of(user.getReminderTimezone());
    } catch (Exception ex) {
      return ReviewService.APP_ZONE;
    }
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

    ZonedDateTime local = now.atZone(zoneOf(user));
    if (local.getHour() != user.getReminderHour()) {
      return false;
    }

    // The job runs every 15 minutes, so without this it would fire four times in the hour.
    LocalDate localDate = local.toLocalDate();
    return !localDate.equals(user.getLastRemindedOn());
  }

  /**
   * The checklist push for these tasks, or empty when none of them falls on a lead day.
   *
   * <p>The nearest deadline wins, and within a day the category order does, then the
   * template's: "Register your address" and "Enroll in health insurance" both land on day 14,
   * and the first is the one the second depends on. Category first because {@code sortOrder}
   * restarts inside each category — ordered by it alone, health insurance (WORK_ADMIN #1)
   * would headline over the address (VISA_IMMIGRATION #8).
   *
   * <p>Pure and static, like {@link #isDue}, so the copy is testable without a database.
   */
  static Optional<Message> checklistMessage(List<UserChecklistTask> openTasks, LocalDate today) {
    for (int lead : CHECKLIST_LEAD_DAYS) {
      LocalDate day = today.plusDays(lead);
      List<UserChecklistTask> onDay =
          openTasks.stream()
              .filter(t -> !t.isCompleted() && day.equals(t.getDueDate()))
              .sorted(
                  Comparator.comparing((UserChecklistTask t) -> t.getTask().getCategory())
                      .thenComparingInt(t -> t.getTask().getSortOrder()))
              .toList();
      if (onDay.isEmpty()) {
        continue;
      }

      String when = lead == 1 ? "tomorrow" : "in %d days".formatted(lead);
      String heading =
          onDay.size() == 1
              ? "Due %s on your move checklist".formatted(when)
              : "%d tasks due %s on your move checklist".formatted(onDay.size(), when);
      return Optional.of(new Message(heading, checklistBody(onDay)));
    }
    return Optional.empty();
  }

  /**
   * One task is its title. Several are listed one per line, so each deadline is actually
   * named: the first version said "Register your address…, and 1 more", and the task behind
   * "1 more" — health insurance, on the same day — was one the learner could not see without
   * opening the app, which is the thing a deadline push exists to spare them. Past
   * {@link #MAX_LISTED_TASKS} the rest are counted; iOS truncates a long body on the lock
   * screen anyway, and the order puts the one that matters most first.
   */
  static String checklistBody(List<UserChecklistTask> onDay) {
    if (onDay.size() == 1) {
      return onDay.getFirst().getTask().getTitle();
    }
    List<String> lines = new ArrayList<>();
    onDay.stream()
        .limit(MAX_LISTED_TASKS)
        .forEach(t -> lines.add("• " + t.getTask().getTitle()));
    if (onDay.size() > MAX_LISTED_TASKS) {
      lines.add("+%d more".formatted(onDay.size() - MAX_LISTED_TASKS));
    }
    return String.join("\n", lines);
  }

  /**
   * Whether this reminder would say anything true.
   *
   * <p>Two ways to be noise, and both train the learner to swipe the notification away:
   *
   * <ul>
   *   <li>They already studied today — the copy promises to keep a streak that is safe.
   *   <li>Every card is scheduled days ahead. Clearing a deck buys six days of silence from
   *       the algorithm, and a nudge to open an app with nothing in it is worse than none.
   * </ul>
   *
   * <p>Study only. A checklist deadline is a different reason to be told, and studying today
   * does nothing to register an address.
   */
  private boolean isWorthReminding(User user) {
    return suppressionReason(user) == null;
  }

  /**
   * Why this user is not being reminded, or null when they are.
   *
   * <p>Split out so the tick can report WHICH rule fired. "0 worth reminding" is true but
   * useless on its own — "already studied today" is the system working and "nothing due" is
   * often the pacing doing its job, yet both look identical from the outside and neither is
   * a fault.
   */
  private String suppressionReason(User user) {
    if (LocalDate.now(ReviewService.APP_ZONE).equals(user.getLastStudiedOn())) {
      return "already studied today";
    }
    if (!reviewService.hasWorkAvailable(user.getId())) {
      return "no cards due and today's new-card intake is spent";
    }
    return null;
  }

  /**
   * The one push this user gets today, or empty when there is nothing worth saying.
   *
   * <p>Still ONE a day, whichever it is: the privacy policy promises "the one daily reminder
   * you asked for", and a second push on deadline days is how a channel gets muted in the
   * weeks it matters most. The checklist wins because a missed visa step costs more than a
   * missed review — the cards will still be there tomorrow.
   */
  private Optional<Message> messageFor(User user, LocalDate localToday) {
    List<LocalDate> leadDays =
        CHECKLIST_LEAD_DAYS.stream().map(d -> localToday.plusDays(d)).toList();
    Optional<Message> checklist =
        checklistMessage(
            checklistTaskRepository.findOpenDueOn(user.getId(), leadDays), localToday);
    if (checklist.isPresent()) {
      return checklist;
    }
    return isWorthReminding(user) ? Optional.of(new Message(HEADING, CONTENT)) : Optional.empty();
  }

  /**
   * Runs every 15 minutes rather than hourly: a user's timezone can be offset by 30 or 45
   * minutes (India, Nepal, Chatham), and an hourly tick would drift against them.
   */
  @Scheduled(cron = "0 0,15,30,45 * * * *")
  @Transactional
  public void sendDueReminders() {
    /*
     * Every branch below now says WHY it stopped.
     *
     * This method used to log only when it actually sent, which made "the reminder never
     * arrived" undiagnosable from the logs: an unset REST key, nobody whose hour had come
     * round, and everybody filtered out as not worth reminding were all indistinguishable
     * silence. One line per tick is 96 a day, which is nothing against the 10 MB the Docker
     * log driver allows.
     */
    if (!oneSignal.isConfigured()) {
      log.warn(
          "Reminder tick skipped: OneSignal is not configured. Set ONESIGNAL_REST_API_KEY"
              + " (and ONESIGNAL_APP_ID) in the deployment environment.");
      return;
    }

    Instant now = Instant.now();

    List<User> candidates = userRepository.findAllByReminderHourNotNull();
    List<User> atTheirHour = candidates.stream().filter(user -> isDue(user, now)).toList();

    // Only now, on the handful of users whose hour has actually come round: deciding what to
    // say is a few queries each, which is fine per tick and pointless for everyone else.
    Map<Message, List<User>> byMessage = new LinkedHashMap<>();
    List<String> suppressed = new ArrayList<>();
    for (User user : atTheirHour) {
      Optional<Message> message = messageFor(user, now.atZone(zoneOf(user)).toLocalDate());
      if (message.isPresent()) {
        byMessage.computeIfAbsent(message.get(), m -> new ArrayList<>()).add(user);
      } else {
        suppressed.add("%s: %s".formatted(user.getFirebaseUid(), suppressionReason(user)));
      }
    }

    if (byMessage.isEmpty()) {
      /*
       * The three counts tell the whole story at a glance:
       *   candidates 0            → nobody has a reminder hour set at all
       *   atTheirHour 0           → set, but nobody's local hour matches this tick, or they
       *                             have already been reminded today (lastRemindedOn)
       *   due 0 with atTheirHour>0→ no checklist deadline close, and the study nudge was
       *                             suppressed: already studied today, or every card is
       *                             scheduled ahead
       */
      log.info(
          "Reminder tick: nothing sent — {} with a reminder set, {} at their hour, 0 worth"
              + " reminding {}",
          candidates.size(),
          atTheirHour.size(),
          suppressed);
      return;
    }

    for (Map.Entry<Message, List<User>> entry : byMessage.entrySet()) {
      Message message = entry.getKey();
      List<String> externalIds = entry.getValue().stream().map(User::getFirebaseUid).toList();
      for (int start = 0;
          start < externalIds.size();
          start += OneSignalClient.MAX_ALIASES_PER_REQUEST) {
        List<String> batch =
            externalIds.subList(
                start,
                Math.min(start + OneSignalClient.MAX_ALIASES_PER_REQUEST, externalIds.size()));
        oneSignal.send(batch, message.heading(), message.content());
      }

      // The external ids are the Firebase UIDs OneSignal was told about by
      // `OneSignal.login(uid)`. If a push silently never lands, this is the value to check
      // against the OneSignal dashboard's Audience — an id it has never seen comes back as
      // `invalid_aliases`, which OneSignalClient logs at INFO.
      log.info(
          "Reminder tick: sent \"{}\" to {} users: {}",
          message.heading(),
          externalIds.size(),
          externalIds);
    }

    // Stamped whether or not the push succeeded. A failed send is not worth retrying on the
    // next tick — a reminder that lands an hour late is worse than one that never arrives.
    for (List<User> users : byMessage.values()) {
      for (User user : users) {
        user.setLastRemindedOn(now.atZone(zoneOf(user)).toLocalDate());
      }
    }

    if (!suppressed.isEmpty()) {
      log.info("Reminder tick: {} not worth reminding {}", suppressed.size(), suppressed);
    }
  }
}
