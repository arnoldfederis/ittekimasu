package app.ittekimasu.server.dto.response;

/**
 * What each button would do to this card, in days. Computed server-side so the algorithm has
 * exactly one implementation — the review screen shows "Good → next review in 6 days" to make
 * the scheduling visible, which is what encourages honest self-rating.
 */
public record IntervalPreviewResponse(int again, int hard, int good, int easy) {}
