package app.ittekimasu.server.dto.request;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

/** {@code targetMoveDate} is what every task's due date is computed from. */
public record CreateChecklistRequest(
    @NotNull UUID templateId, @NotNull LocalDate targetMoveDate) {}
