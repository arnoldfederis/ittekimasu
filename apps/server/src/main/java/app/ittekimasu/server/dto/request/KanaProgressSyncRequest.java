package app.ittekimasu.server.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * A device's whole kana snapshot, sent once per finished or saved quiz session.
 *
 * <p>Capped comfortably above the chart (107 kana in each of two scripts), so a real snapshot
 * always fits and a runaway client cannot turn one request into thousands of upserts.
 */
public record KanaProgressSyncRequest(
    @NotNull @Size(max = 300) List<@Valid @NotNull KanaProgressItemRequest> items) {}
