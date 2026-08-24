package app.ittekimasu.server.exception;

/**
 * The caller is authenticated but the thing they asked for needs premium: a locked deck, or
 * reviews past the free daily allowance. Maps to 402, which the mobile client treats as the
 * paywall trigger (see {@code ApiError.requiresPremium}).
 */
public class PaymentRequiredException extends RuntimeException {
  public PaymentRequiredException(String message) {
    super(message);
  }
}
