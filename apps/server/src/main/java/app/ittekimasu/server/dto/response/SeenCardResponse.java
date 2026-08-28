package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.UserCardProgress;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One card the learner has answered at least once, with where it currently stands.
 *
 * <p>{@code lastRating} is null for progress written before V15 introduced the column — the
 * client shows those as unrated rather than inventing a difficulty for them.
 */
public record SeenCardResponse(
    UUID cardId,
    String frontText,
    String backText,
    String cardType,
    UUID courseId,
    String courseTitle,
    String lastRating,
    int intervalDays,
    LocalDate nextReviewDate,
    int streakCount,
    /**
     * What each of the four answers would schedule from where this card stands NOW.
     *
     * <p>Easy on a card already six days out is twenty-plus days, not six — the multiplier
     * applies to the current interval. Showing the number before the tap is the difference
     * between an informed choice and a surprise.
     */
    IntervalPreviewResponse intervals) {

  public static SeenCardResponse from(
      UserCardProgress progress, IntervalPreviewResponse intervals) {
    var card = progress.getCard();
    return new SeenCardResponse(
        card.getId(),
        card.getFrontText(),
        card.getBackText(),
        card.getCardType().name(),
        card.getCourse().getId(),
        card.getCourse().getTitle(),
        progress.getLastRating() == null ? null : progress.getLastRating().name(),
        progress.getIntervalDays(),
        progress.getNextReviewDate(),
        progress.getStreakCount(),
        intervals);
  }
}
