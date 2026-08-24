package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.UserCardProgress;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserCardProgressRepository extends JpaRepository<UserCardProgress, UUID> {

  Optional<UserCardProgress> findByUserIdAndCardId(UUID userId, UUID cardId);

  List<UserCardProgress> findAllByUserIdAndCardIdIn(UUID userId, Collection<UUID> cardIds);

  /** Distinct cards touched since the start of the app-timezone day — the free daily cap. */
  int countByUserIdAndLastReviewedAtGreaterThanEqual(UUID userId, Instant since);

  /** How many of a deck's cards the user has ever reviewed, for the progress bar. */
  int countByUserIdAndCardCourseId(UUID userId, UUID courseId);
}
