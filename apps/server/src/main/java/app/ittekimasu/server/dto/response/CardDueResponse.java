package app.ittekimasu.server.dto.response;

import java.util.UUID;

/**
 * One card in a review session. The back is already the full answer string
 * ({@code reading · meaning}) — the client reveals it, it never assembles it.
 */
public record CardDueResponse(
    UUID id,
    String frontText,
    String backText,
    String cardType,
    /** False for a card the learner has never been shown, which the session labels "New". */
    boolean seen,
    IntervalPreviewResponse intervals) {}
