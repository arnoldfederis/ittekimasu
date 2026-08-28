package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.UserStudyDay;
import java.time.LocalDate;

/**
 * One filled square on the study grid.
 *
 * <p>Days with no study are ABSENT rather than sent as zeroes: the client knows the range it
 * asked for and can fill the gaps itself, and an empty grid should not cost 120 rows.
 */
public record StudyDayResponse(LocalDate date, int reviewCount) {

  public static StudyDayResponse from(UserStudyDay day) {
    return new StudyDayResponse(day.getStudiedOn(), day.getReviewCount());
  }
}
