package app.ittekimasu.server.repository;

import app.ittekimasu.server.entity.Course;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseRepository extends JpaRepository<Course, UUID> {
  List<Course> findAllByOrderBySortOrderAsc();

  List<Course> findAllByTopicIgnoreCaseOrderBySortOrderAsc(String topic);
}
