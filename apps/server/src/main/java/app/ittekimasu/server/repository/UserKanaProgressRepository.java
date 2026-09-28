package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.UserKanaProgress;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserKanaProgressRepository extends JpaRepository<UserKanaProgress, UUID> {

  /** One user's whole backup, in a stable order so the response does not shuffle. */
  List<UserKanaProgress> findAllByUserIdOrderByGlyphAsc(UUID userId);

  /** For "Start learning over". Account deletion needs nothing: the FK cascades. */
  void deleteAllByUserId(UUID userId);

  /**
   * Folds one kana's device totals into the backup, keeping the LARGER of each value.
   *
   * <p>Why the larger rather than the incoming: the device sends running totals, which only
   * ever grow. So the larger value is always the more complete one, and keeping it makes the
   * write idempotent — the same snapshot sent twice (a retry, or an offline upload replayed
   * after reconnecting) changes nothing — and order-independent, so two devices never erase
   * each other's progress.
   *
   * <p>A native upsert, as in {@code UserStudyDayRepository}: two uploads at once would both
   * see "no row yet" in a read-then-write, and the second insert would trip the unique
   * constraint.
   *
   * <p>{@code clearAutomatically}: a native statement writes straight to the table and never
   * touches Hibernate's persistence context, so a row already loaded in this transaction keeps
   * its OLD values — and the read that follows returns that cached copy rather than the merged
   * row. Two syncs in one transaction returned the first sync's totals; clearing after the
   * write makes the next read go to the database. {@code flushAutomatically} writes anything
   * pending first, so the clear cannot discard it.
   */
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query(
      value =
          """
          INSERT INTO user_kana_progress
              (user_id, glyph, correct_count, attempt_count, total_answer_ms)
          VALUES (:userId, :glyph, :correct, :attempts, :totalMs)
          ON CONFLICT (user_id, glyph) DO UPDATE SET
              correct_count   = GREATEST(user_kana_progress.correct_count,   EXCLUDED.correct_count),
              attempt_count   = GREATEST(user_kana_progress.attempt_count,   EXCLUDED.attempt_count),
              total_answer_ms = GREATEST(user_kana_progress.total_answer_ms, EXCLUDED.total_answer_ms),
              updated_at      = now()
          """,
      nativeQuery = true)
  void mergeLargest(UUID userId, String glyph, int correct, int attempts, long totalMs);
}
