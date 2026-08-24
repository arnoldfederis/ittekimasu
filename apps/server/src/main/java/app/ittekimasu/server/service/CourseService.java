package app.ittekimasu.server.service;

import app.ittekimasu.server.dto.response.CourseSummaryResponse;
import app.ittekimasu.server.entity.Course;
import app.ittekimasu.server.repository.CardRepository;
import app.ittekimasu.server.repository.CourseRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CourseService {

  private final CourseRepository courseRepository;
  private final CardRepository cardRepository;

  public CourseService(CourseRepository courseRepository, CardRepository cardRepository) {
    this.courseRepository = courseRepository;
    this.cardRepository = cardRepository;
  }

  /**
   * Every course, premium ones included. The learn tab shows locked decks dimmed rather than
   * hiding them — seeing what exists is what makes the paywall feel like an unlock.
   */
  @Transactional(readOnly = true)
  public List<CourseSummaryResponse> listCourses(String topic) {
    List<Course> courses =
        topic == null || topic.isBlank()
            ? courseRepository.findAllByOrderBySortOrderAsc()
            : courseRepository.findAllByTopicIgnoreCaseOrderBySortOrderAsc(topic);

    // One count query per course. Fine at this size; revisit if the catalogue grows.
    return courses.stream()
        .map(course -> CourseSummaryResponse.from(course, cardRepository.countByCourseId(course.getId())))
        .toList();
  }
}
