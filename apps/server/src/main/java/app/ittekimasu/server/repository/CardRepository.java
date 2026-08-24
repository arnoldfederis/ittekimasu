package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.Card;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardRepository extends JpaRepository<Card, UUID> {
  List<Card> findAllByCourseIdOrderBySortOrderAsc(UUID courseId);

  /** Drives the "N cards" label without loading every row. */
  int countByCourseId(UUID courseId);
}
