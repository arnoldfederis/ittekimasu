package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.ChecklistCategory;
import app.ittekimasu.server.entity.UserChecklistTask;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserChecklistTaskRepository extends JpaRepository<UserChecklistTask, UUID> {

  /**
   * Joins the template task in one query. Without the fetch join every row would lazy-load
   * its title and category, and with open-in-view off that throws outside the transaction.
   */
  @Query(
      """
      SELECT uct FROM UserChecklistTask uct
      JOIN FETCH uct.task t
      WHERE uct.user.id = :userId
      ORDER BY uct.dueDate ASC, t.sortOrder ASC
      """)
  List<UserChecklistTask> findAllForUser(UUID userId);

  @Query(
      """
      SELECT uct FROM UserChecklistTask uct
      JOIN FETCH uct.task t
      WHERE uct.user.id = :userId AND t.category = :category
      ORDER BY uct.dueDate ASC, t.sortOrder ASC
      """)
  List<UserChecklistTask> findAllForUserByCategory(UUID userId, ChecklistCategory category);

  /**
   * Unfinished tasks falling due on one of the given days. Feeds the checklist reminder, which
   * only ever asks about a couple of specific dates and orders the handful it gets itself —
   * category is a VARCHAR, so ORDER BY here would sort it alphabetically, not in enum order.
   */
  @Query(
      """
      SELECT uct FROM UserChecklistTask uct
      JOIN FETCH uct.task t
      WHERE uct.user.id = :userId AND uct.completed = false AND uct.dueDate IN :dates
      """)
  List<UserChecklistTask> findOpenDueOn(UUID userId, Collection<LocalDate> dates);

  void deleteAllByUserId(UUID userId);
}
