package app.ittekimasu.server.dto.response;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The outcome of one answer. Everything the session footer and the completion screen need,
 * so rating a card costs exactly one round trip.
 */
public record ReviewResultResponse(
    UUID cardId,
    String rating,
    int intervalDays,
    LocalDate nextReviewDate,
    double easeFactor,
    /** Consecutive non-AGAIN answers for this card. */
    int cardStreakCount,
    /** Consecutive days the learner has reviewed something — the flame. */
    int studyStreakDays,
    int longestStreakDays,
    int reviewsRemainingToday) {}
