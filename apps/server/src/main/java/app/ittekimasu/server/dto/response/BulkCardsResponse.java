package app.ittekimasu.server.dto.response;

/**
 * How many cards a bulk action touched.
 *
 * <p>A count rather than 204, because "Reset 104 cards" is the only confirmation the learner
 * gets that something wholesale actually happened.
 */
public record BulkCardsResponse(int affected) {}
