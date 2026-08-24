package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.Course;
import java.util.UUID;

/**
 * List-view shape for the learn tab. {@code cardCount} is included so the card can show
 * "100 cards" without a second call, and it is 0 for the premium decks that have no content
 * seeded yet.
 */
public record CourseSummaryResponse(
    UUID id,
    String title,
    String topic,
    String level,
    String description,
    boolean isPremium,
    int cardCount) {

  public static CourseSummaryResponse from(Course course, int cardCount) {
    return new CourseSummaryResponse(
        course.getId(),
        course.getTitle(),
        course.getTopic(),
        course.getLevel(),
        course.getDescription(),
        course.isPremium(),
        cardCount);
  }
}
