package app.ittekimasu.server.exception;

public class ResourceNotFoundException extends RuntimeException {
  public ResourceNotFoundException(String message) {
    super(message);
  }

  public ResourceNotFoundException(String resource, Object identifier) {
    super("%s not found: %s".formatted(resource, identifier));
  }
}
