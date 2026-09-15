package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, UUID> {

  /** The reminder scheduler's only query — everyone who actually asked to be reminded. */
  List<User> findAllByReminderHourNotNull();

  Optional<User> findByFirebaseUid(String firebaseUid);

  /**
   * Creates the row for a first-time caller, or does nothing if someone else got there first.
   *
   * <p>A native upsert rather than a read-then-write, for the same reason
   * {@code UserStudyDayRepository.recordReview} is one: the app fires several authenticated
   * requests the instant a user signs in, and on a brand-new account every one of them runs
   * {@code findOrCreate} concurrently. All of them saw "no row yet", all of them inserted,
   * and the losers died on {@code uc_users_firebase_uid} — a 500 on the very first screen
   * after sign-in.
   *
   * <p>{@code DO NOTHING} rather than {@code DO UPDATE}: the caller re-reads and runs
   * {@code backfill}, which knows not to overwrite a name Apple will never send again.
   *
   * <p>Catching the constraint violation instead would not work — by the time Postgres
   * raises it the transaction is already marked rollback-only, so the recovering read
   * cannot run in it.
   */
  @Modifying
  @Query(
      value =
          """
          INSERT INTO users (id, firebase_uid, email, display_name, created_at, updated_at)
          VALUES (gen_random_uuid(), :firebaseUid, :email, :displayName, now(), now())
          ON CONFLICT (firebase_uid) DO NOTHING
          """,
      nativeQuery = true)
  void insertIfAbsent(String firebaseUid, String email, String displayName);
}
