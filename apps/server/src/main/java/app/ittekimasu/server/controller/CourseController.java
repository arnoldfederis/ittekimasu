package app.ittekimasu.server.controller;

import app.ittekimasu.server.dto.response.CourseSummaryResponse;
import app.ittekimasu.server.dto.response.DueCardsResponse;
import app.ittekimasu.server.security.FirebasePrincipal;
import app.ittekimasu.server.service.CourseService;
import app.ittekimasu.server.service.ReviewService;
import app.ittekimasu.server.service.UserService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/courses")
public class CourseController {

  private final CourseService courseService;
  private final ReviewService reviewService;
  private final UserService userService;

  public CourseController(
      CourseService courseService, ReviewService reviewService, UserService userService) {
    this.courseService = courseService;
    this.reviewService = reviewService;
    this.userService = userService;
  }

  /** @param topic optional filter, e.g. JLPT. */
  @GetMapping
  public List<CourseSummaryResponse> listCourses(@RequestParam(required = false) String topic) {
    return courseService.listCourses(topic);
  }

  /** A review session: due cards then new ones, capped at the caller's daily allowance. */
  @GetMapping("/{courseId}/due")
  public DueCardsResponse listDue(
      @AuthenticationPrincipal FirebasePrincipal principal, @PathVariable UUID courseId) {
    return reviewService.listDue(userService.findOrCreate(principal).getId(), courseId);
  }
}
