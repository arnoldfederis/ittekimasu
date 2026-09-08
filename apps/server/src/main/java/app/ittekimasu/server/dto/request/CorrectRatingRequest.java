package app.ittekimasu.server.dto.request;

import app.ittekimasu.server.entity.ReviewRating;
import jakarta.validation.constraints.NotNull;

/** Changes the answer already recorded for one card. */
public record CorrectRatingRequest(@NotNull ReviewRating rating) {}
