package app.ittekimasu.server.dto.request;

import app.ittekimasu.server.entity.ReviewRating;
import jakarta.validation.constraints.NotNull;

/** AGAIN / HARD / GOOD / EASY. A missing rating is a client bug, so it fails validation. */
public record SubmitReviewRequest(@NotNull ReviewRating rating) {}
