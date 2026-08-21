package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.ChecklistTemplate;
import app.ittekimasu.server.entity.VisaPurpose;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChecklistTemplateRepository extends JpaRepository<ChecklistTemplate, UUID> {
  List<ChecklistTemplate> findAllByOrderBySortOrderAsc();

  List<ChecklistTemplate> findAllByPurposeOrderBySortOrderAsc(VisaPurpose purpose);

  /**
   * Fetches the tasks in the same query. Without the graph this throws once the detail DTO
   * touches the list, because open-in-view is off and the session is already closed.
   */
  @EntityGraph(attributePaths = "tasks")
  Optional<ChecklistTemplate> findByVisaType(String visaType);
}
