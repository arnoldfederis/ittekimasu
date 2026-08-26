package app.ittekimasu.server.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Turns the daily reminder on, off, or moves it.
 *
 * @param reminderHour 0-23 in the caller's timezone, or null to switch reminders off. Boxed on
 *     purpose — null is a real value here, not a missing field.
 * @param reminderTimezone IANA zone, e.g. Asia/Tokyo. Ignored when the hour is null.
 */
public record UpdateRemindersRequest(
    @Min(0) @Max(23) Integer reminderHour, String reminderTimezone) {}
