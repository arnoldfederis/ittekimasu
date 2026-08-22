package app.ittekimasu.server.dto.request;

import jakarta.validation.constraints.NotNull;

/** Boxed Boolean on purpose: a missing field must fail validation, not default to false. */
public record UpdateChecklistTaskRequest(@NotNull Boolean completed) {}
