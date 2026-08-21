package app.ittekimasu.server.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Verifies the Firebase ID token on every request and puts a {@link FirebasePrincipal} in the
 * SecurityContext. Every route resolves the current user from here — never from a path variable.
 *
 * <p>A missing or unverifiable token is not rejected here: the chain continues unauthenticated so
 * that permitAll routes (the RevenueCat webhook, the API docs) still work, and the
 * AuthenticationEntryPoint in SecurityConfig produces the single, consistent 401 for everything
 * that does require auth.
 *
 * <p>Deliberately not a {@code @Component}: Boot would auto-register it as a plain servlet filter
 * in addition to its place in the security chain, and the copy that runs first would have its
 * SecurityContext wiped by {@code SecurityContextHolderFilter} before the request reached a
 * controller. {@link app.ittekimasu.server.config.SecurityConfig} constructs it instead.
 */
public class FirebaseTokenFilter extends OncePerRequestFilter {

  private static final String BEARER_PREFIX = "Bearer ";

  private final FirebaseAuth firebaseAuth;

  public FirebaseTokenFilter(FirebaseAuth firebaseAuth) {
    this.firebaseAuth = firebaseAuth;
  }

  @Override
  protected void doFilterInternal(
      @NonNull HttpServletRequest request,
      @NonNull HttpServletResponse response,
      @NonNull FilterChain filterChain)
      throws ServletException, IOException {

    String header = request.getHeader(HttpHeaders.AUTHORIZATION);
    if (header != null && header.startsWith(BEARER_PREFIX)) {
      authenticate(header.substring(BEARER_PREFIX.length()));
    }

    filterChain.doFilter(request, response);
  }

  private void authenticate(String idToken) {
    try {
      FirebaseToken token = firebaseAuth.verifyIdToken(idToken);
      FirebasePrincipal principal =
          new FirebasePrincipal(token.getUid(), token.getEmail(), token.getName());

      SecurityContextHolder.getContext()
          .setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    } catch (FirebaseAuthException | IllegalArgumentException ex) {
      // Expired, malformed, or wrong-project token. Leave the context anonymous.
      SecurityContextHolder.clearContext();
      logger.debug("Rejected Firebase ID token: " + ex.getMessage());
    }
  }
}
