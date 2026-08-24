package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.Card;
import java.time.LocalDate;
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
   * A review session: cards whose next review has come around, then cards never seen. The
   * entity join is a LEFT JOIN on purpose — an unreviewed card has no progress row at all,
   * so an inner join would hide exactly the cards a new learner needs.
   *
   * <p>Due cards come first (soonest first) so a backlog is cleared before new material is
   * added to it. Pass the daily allowance as the page size.
   */
  @Query(
      """
      SELECT c FROM Card c
      LEFT JOIN UserCardProgress p ON p.card = c AND p.user.id = :userId
      WHERE c.course.id = :courseId
        AND (p.id IS NULL OR p.nextReviewDate <= :today)
      ORDER BY CASE WHEN p.id IS NULL THEN 1 ELSE 0 END ASC,
               p.nextReviewDate ASC,
               c.sortOrder ASC
      """)
  List<Card> findDueCards(UUID userId, UUID courseId, LocalDate today, Pageable pageable);
}
