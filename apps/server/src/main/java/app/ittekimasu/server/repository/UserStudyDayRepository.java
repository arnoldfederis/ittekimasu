package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.UserStudyDay;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserStudyDayRepository extends JpaRepository<UserStudyDay, UUID> {

  /** The grid: one user's recent days, oldest first so the client can render left to right. */
  List<UserStudyDay> findAllByUserIdAndStudiedOnGreaterThanEqualOrderByStudiedOnAsc(
      UUID userId, LocalDate from);

  /** The whole grid, for a wholesale reset. */
  void deleteAllByUserId(UUID userId);

  /**
   * Records one review against a day, creating the row on the first review of that day.
   *
   * <p>A native upsert rather than a read-then-write: two reviews submitted at the same
   * moment would both see "no row yet" and the second insert would trip the unique
   * constraint. Postgres settles it in one statement.
   */
  @Modifying
  @Query(
      value =
          """
          INSERT INTO user_study_days (user_id, studied_on, review_count)
          VALUES (:userId, :day, 1)
          ON CONFLICT (user_id, studied_on)
              DO UPDATE SET review_count = user_study_days.review_count + 1
          """,
      nativeQuery = true)
  void recordReview(UUID userId, LocalDate day);
}
