package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.ChecklistTask;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChecklistTaskRepository extends JpaRepository<ChecklistTask, UUID> {
  List<ChecklistTask> findAllByTemplateIdOrderBySortOrderAsc(UUID templateId);
}
