package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.response.CourseSummaryResponse;
import app.ittekimasu.server.service.CourseService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/courses")
public class CourseController {

  private final CourseService courseService;

  public CourseController(CourseService courseService) {
    this.courseService = courseService;
  }

  /** @param topic optional filter, e.g. JLPT. */
  @GetMapping
  public List<CourseSummaryResponse> listCourses(@RequestParam(required = false) String topic) {
    return courseService.listCourses(topic);
  }
}
