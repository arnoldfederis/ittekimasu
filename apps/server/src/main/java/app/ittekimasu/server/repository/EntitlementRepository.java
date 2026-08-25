package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.Entitlement;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EntitlementRepository extends JpaRepository<Entitlement, UUID> {
  Optional<Entitlement> findByUserId(UUID userId);
}
