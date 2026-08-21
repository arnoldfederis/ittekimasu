package app.ittekimasu.server.config;

import app.ittekimasu.server.dto.response.ErrorResponse;
import app.ittekimasu.server.security.FirebaseTokenFilter;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.json.JsonMapper;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  private final FirebaseAuth firebaseAuth;
  private final JsonMapper jsonMapper;

  public SecurityConfig(FirebaseAuth firebaseAuth, JsonMapper jsonMapper) {
    this.firebaseAuth = firebaseAuth;
    this.jsonMapper = jsonMapper;
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth
                    // RevenueCat signs its webhooks with a shared secret, not a Firebase JWT.
                    .requestMatchers("/api/webhooks/**")
                    .permitAll()
                    .requestMatchers("/api-docs/**", "/v3/api-docs/**", "/actuator/health")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(handling -> handling.authenticationEntryPoint(unauthorizedEntryPoint()))
        .addFilterBefore(
            new FirebaseTokenFilter(firebaseAuth), UsernamePasswordAuthenticationFilter.class);

    return http.build();
  }

  /** Returns JSON 401s instead of Spring Security's default HTML/basic-auth challenge. */
  private AuthenticationEntryPoint unauthorizedEntryPoint() {
    return (request, response, authException) -> {
      response.setStatus(HttpStatus.UNAUTHORIZED.value());
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      jsonMapper.writeValue(
          response.getOutputStream(),
          ErrorResponse.of(
              HttpStatus.UNAUTHORIZED.value(),
              "Unauthorized",
              "A valid Firebase ID token is required."));
    };
  }
}
