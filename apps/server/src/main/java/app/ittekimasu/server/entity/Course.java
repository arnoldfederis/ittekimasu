package app.ittekimasu.server.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CurrentTimestamp;
import org.hibernate.generator.EventType;

/** An ordered deck of cards. Topic-agnostic so the engine is not tied to JLPT. */
@Entity
@Table(name = "courses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Course {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "title", nullable = false, length = 120)
	private String title;

	@Column(name = "topic", nullable = false, length = 64)
	private String topic;

	@Column(name = "level", length = 32)
	private String level;

	@Column(name = "description")
	private String description;

	/** Checked server-side against the user's entitlement. Never trusted from the client. */
	@Column(name = "is_premium", nullable = false)
	private boolean premium;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sortOrder ASC")
	private List<Card> cards = new ArrayList<>();

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
