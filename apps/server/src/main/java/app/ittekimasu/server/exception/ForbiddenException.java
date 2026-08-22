package app.ittekimasu.server.exception;

/** The caller is authenticated but the resource is not theirs. */
public class ForbiddenException extends RuntimeException {
  public ForbiddenException(String message) {
    super(message);
  }
}
