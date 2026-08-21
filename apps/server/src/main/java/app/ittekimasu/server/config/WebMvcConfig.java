package app.ittekimasu.server.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Prefixes every application controller with {@code /api} so controllers declare only their own
 * path (e.g. {@code /users}) and the effective route is {@code /api/users}.
 *
 * <p>Done here rather than via a servlet context path so the Scalar/OpenAPI UI stays at
 * {@code /api-docs} instead of being dragged under the prefix too.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

  @Override
  public void configurePathMatch(PathMatchConfigurer configurer) {
    configurer.addPathPrefix(
        "/api", HandlerTypePredicate.forBasePackage("app.ittekimasu.server.controller"));
  }
}
