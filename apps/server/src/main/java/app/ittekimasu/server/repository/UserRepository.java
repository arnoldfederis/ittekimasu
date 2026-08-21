package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
  Optional<User> findByFirebaseUid(String firebaseUid);
}
