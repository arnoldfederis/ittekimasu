package app.ittekimasu.server.dto.response;

import java.util.List;
import java.util.UUID;

/**
 * A whole review session, not just the cards.
 *
 * <p>The counts matter as much as the list: an empty {@code cards} means "nothing due, come
 * back tomorrow" when {@code reviewsRemainingToday > 0}, and "you have used today's free
 * allowance" when it is 0. The client cannot tell those apart from a bare array.
 */
public record DueCardsResponse(
    UUID courseId,
    String courseTitle,
    List<CardDueResponse> cards,
    /** Cards in the deck the learner has reviewed at least once, for the progress bar. */
    int reviewedCardCount,
    int totalCardCount,
    int dailyLimit,
    int reviewsRemainingToday,
    int studyStreakDays) {}
