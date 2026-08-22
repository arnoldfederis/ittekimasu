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

/** A user's copy of one template task, with the due date resolved against their move date. */
@Entity
@Table(name = "user_checklist_tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserChecklistTask {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "task_id", nullable = false)
	private ChecklistTask task;

	@Column(name = "completed", nullable = false)
	private boolean completed;

	@Column(name = "due_date")
	private LocalDate dueDate;

	@Column(name = "completed_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
	private Instant completedAt;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
