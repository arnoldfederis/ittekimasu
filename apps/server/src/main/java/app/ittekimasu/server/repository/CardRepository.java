package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.Card;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CardRepository extends JpaRepository<Card, UUID> {
  List<Card> findAllByCourseIdOrderBySortOrderAsc(UUID courseId);

  /** Drives the "N cards" label without loading every row. */
  int countByCourseId(UUID courseId);

  /**
   * Cards the learner has seen whose next review has come around, soonest first.
   *
   * <p>Split from the unseen query because a session bounds them differently: everything due
   * is fair game up to the daily allowance, but NEW cards are paced (see
   * ReviewService.NEW_CARDS_PER_DAY) so a 104-card deck is not handed over in one sitting.
   */
  @Query(
      """
      SELECT c FROM Card c
      JOIN UserCardProgress p ON p.card = c AND p.user.id = :userId
      WHERE c.course.id = :courseId AND p.nextReviewDate <= :today
      ORDER BY p.nextReviewDate ASC, c.sortOrder ASC
      """)
  List<Card> findDueSeenCards(UUID userId, UUID courseId, LocalDate today, Pageable pageable);

  /**
   * Cards never answered, in deck order. The LEFT JOIN is the point — an unseen card has no
   * progress row at all, so an inner join would hide exactly what a new learner needs.
   */
  @Query(
      """
      SELECT c FROM Card c
      LEFT JOIN UserCardProgress p ON p.card = c AND p.user.id = :userId
      WHERE c.course.id = :courseId AND p.id IS NULL
      ORDER BY c.sortOrder ASC
      """)
  List<Card> findUnseenInCourse(UUID userId, UUID courseId, Pageable pageable);

  /** How much of a deck the learner has never been shown — "94 still to come". */
  @Query(
      """
      SELECT count(c) FROM Card c
      LEFT JOIN UserCardProgress p ON p.card = c AND p.user.id = :userId
      WHERE c.course.id = :courseId AND p.id IS NULL
      """)
  int countUnseenInCourse(UUID userId, UUID courseId);

  /**
   * Cards the user has never seen, across every deck they can actually open.
   *
   * <p>`premiumFlags` is the accessible set — `[false]` for a free user, `[false, true]` for
   * premium — rather than a boolean parameter, which JPQL cannot compare to a literal
   * cleanly. A locked deck is not work the learner skipped, so it must not count.
   */
  @Query(
      """
      SELECT count(c) FROM Card c
      LEFT JOIN UserCardProgress p ON p.card = c AND p.user.id = :userId
      WHERE p.id IS NULL AND c.course.premium IN :premiumFlags
      """)
  long countUnseen(UUID userId, Collection<Boolean> premiumFlags);
}
