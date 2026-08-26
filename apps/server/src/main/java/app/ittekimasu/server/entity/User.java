package app.ittekimasu.server.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CurrentTimestamp;
import org.hibernate.generator.EventType;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "firebase_uid", nullable = false, unique = true, length = 128)
	private String firebaseUid;

	@Column(name = "email", nullable = false)
	private String email;

	@Column(name = "display_name")
	private String displayName;

	/** The date every checklist due date was computed from. Null until onboarding finishes. */
	@Column(name = "target_move_date")
	private LocalDate targetMoveDate;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "checklist_template_id")
	private ChecklistTemplate checklistTemplate;

	/**
	 * Consecutive days with at least one review. Kept here rather than derived from
	 * user_card_progress, which only remembers the latest review per card.
	 */
	@Column(name = "current_streak_days", nullable = false)
	private int currentStreakDays;

	@Column(name = "longest_streak_days", nullable = false)
	private int longestStreakDays;

	/** The last day the user reviewed anything, in the app's timezone. */
	@Column(name = "last_studied_on")
	private LocalDate lastStudiedOn;

	/** 0-23 in {@link #reminderTimezone}. Null means the daily reminder is off. */
	@Column(name = "reminder_hour")
	private Short reminderHour;

	/** IANA zone the reminder hour is expressed in, e.g. Asia/Tokyo. */
	@Column(name = "reminder_timezone", length = 64)
	private String reminderTimezone;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
