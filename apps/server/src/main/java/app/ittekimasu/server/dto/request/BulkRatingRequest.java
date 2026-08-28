package app.ittekimasu.server.dto.request;

import app.ittekimasu.server.entity.ReviewRating;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Re-rates every card the learner has seen, optionally within one deck.
 *
 * @param courseId null means every deck.
 */
public record BulkRatingRequest(UUID courseId, @NotNull ReviewRating rating) {}
