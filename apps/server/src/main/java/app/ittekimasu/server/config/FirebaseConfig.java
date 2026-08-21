package app.ittekimasu.server.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;

@Configuration
public class FirebaseConfig {

  private final ResourceLoader resourceLoader;
  private final String serviceAccountLocation;

  public FirebaseConfig(
      ResourceLoader resourceLoader,
      @Value("${firebase.service-account-location}") String serviceAccountLocation) {
    this.resourceLoader = resourceLoader;
    this.serviceAccountLocation = serviceAccountLocation;
  }

  @Bean
  public FirebaseApp firebaseApp() throws IOException {
    // Spring's DevTools restart and the test context can both re-run this; FirebaseApp throws
    // on a duplicate name, so reuse the existing instance instead.
    if (!FirebaseApp.getApps().isEmpty()) {
      return FirebaseApp.getInstance();
    }

    Resource resource = resourceLoader.getResource(serviceAccountLocation);
    if (!resource.exists()) {
      throw new IllegalStateException(
          "Firebase service account not found at '%s'. Set FIREBASE_SERVICE_ACCOUNT_LOCATION."
              .formatted(serviceAccountLocation));
    }

    try (InputStream credentials = resource.getInputStream()) {
      return FirebaseApp.initializeApp(
          FirebaseOptions.builder()
              .setCredentials(GoogleCredentials.fromStream(credentials))
              .build());
    }
  }

  @Bean
  public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
    return FirebaseAuth.getInstance(firebaseApp);
  }
}
