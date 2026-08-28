package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.UserCardProgress;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserCardProgressRepository extends JpaRepository<UserCardProgress, UUID> {

  Optional<UserCardProgress> findByUserIdAndCardId(UUID userId, UUID cardId);

  List<UserCardProgress> findAllByUserIdAndCardIdIn(UUID userId, Collection<UUID> cardIds);

  /** Distinct cards touched since the start of the app-timezone day — the free daily cap. */
  int countByUserIdAndLastReviewedAtGreaterThanEqual(UUID userId, Instant since);

  /**
   * Cards introduced today, across every deck: a progress row is created the first time a
   * card is answered, so its creation date IS the day that card became "seen". Drives the
   * new-card pacing without a column to maintain.
   */
  int countByUserIdAndCreatedAtGreaterThanEqual(UUID userId, Instant since);

  /** Everything this user has learned, for a wholesale reset. */
  void deleteAllByUserId(UUID userId);

  /** How many of a deck's cards the user has ever reviewed, for the progress bar. */
  int countByUserIdAndCardCourseId(UUID userId, UUID courseId);

  /**
   * Every card this user has answered, deck by deck, in the order the decks are shown.
   *
   * <p>The joins are eager on purpose: the response needs the card text and the deck title
   * for every row, and lazily walking those from a list would be the textbook N+1.
   */
  @Query(
      """
      SELECT p FROM UserCardProgress p
      JOIN FETCH p.card c
      JOIN FETCH c.course course
      WHERE p.user.id = :userId
      ORDER BY course.sortOrder ASC, c.sortOrder ASC
      """)
  List<UserCardProgress> findAllSeenWithCard(UUID userId);

  /** The soonest a card in ONE deck comes back. Null when nothing in it has been reviewed. */
  @Query(
      """
      SELECT min(p.nextReviewDate) FROM UserCardProgress p
      WHERE p.user.id = :userId AND p.card.course.id = :courseId
      """)
  LocalDate findEarliestNextReviewDateForCourse(UUID userId, UUID courseId);

  /**
   * The soonest a seen card comes back, across every deck the user can open. Null when they
   * have reviewed nothing yet.
   *
   * <p>Answers "did this learner have anything to do on the days they were away?" — the
   * question the streak has to ask before it punishes a gap.
   */
  @Query(
      """
      SELECT min(p.nextReviewDate) FROM UserCardProgress p
      WHERE p.user.id = :userId AND p.card.course.premium IN :premiumFlags
      """)
  LocalDate findEarliestNextReviewDate(UUID userId, Collection<Boolean> premiumFlags);
}
