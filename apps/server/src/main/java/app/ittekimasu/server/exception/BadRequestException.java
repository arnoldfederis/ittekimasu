package app.ittekimasu.server.exception;

/** The request is well-formed but asks for something the domain does not allow. */
public class BadRequestException extends RuntimeException {
  public BadRequestException(String message) {
    super(message);
  }
}
