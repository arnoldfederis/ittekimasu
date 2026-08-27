package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

  /** The reminder scheduler's only query — everyone who actually asked to be reminded. */
  List<User> findAllByReminderHourNotNull();
  Optional<User> findByFirebaseUid(String firebaseUid);
}
