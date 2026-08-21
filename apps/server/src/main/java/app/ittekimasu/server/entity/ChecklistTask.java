package app.ittekimasu.server.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CurrentTimestamp;
import org.hibernate.generator.EventType;

/** One task inside a template. Copied into `user_checklist_tasks` when a user adopts it. */
@Entity
@Table(name = "checklist_tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistTask {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "template_id", nullable = false)
	private ChecklistTemplate template;

	@Enumerated(EnumType.STRING)
	@Column(name = "category", nullable = false, length = 32)
	private ChecklistCategory category;

	@Column(name = "title", nullable = false, length = 200)
	private String title;

	/**
	 * Days relative to the user's target move date — negative before the move, positive after
	 * arrival. Ward-office registration is +14 because that is the legal deadline.
	 */
	@Column(name = "default_due_offset_days", nullable = false)
	private int defaultDueOffsetDays;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
