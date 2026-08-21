package app.ittekimasu.server.security;

/**
 * The subset of a verified Firebase ID token the application actually needs.
 *
 * <p>Carrying email and name alongside the uid is what lets {@code UserService.findOrCreate}
 * populate a brand-new row on a user's very first request without a separate registration
 * endpoint — which matters for Sign in with Apple, where the name is only ever present on the
 * first sign-in.
 */
public record FirebasePrincipal(String uid, String email, String name) {}
