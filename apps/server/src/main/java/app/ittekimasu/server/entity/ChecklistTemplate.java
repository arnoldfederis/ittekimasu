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

/** A pre-built checklist tied to one visa route. Reference data, never per-user. */
@Entity
@Table(name = "checklist_templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistTemplate {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "visa_type", nullable = false, unique = true, length = 64)
	private String visaType;

	@Column(name = "country", nullable = false, length = 2)
	private String country;

	@Enumerated(EnumType.STRING)
	@Column(name = "purpose", nullable = false, length = 32)
	private VisaPurpose purpose;

	@Column(name = "display_name", nullable = false, length = 120)
	private String displayName;

	@Column(name = "japanese_name", length = 120)
	private String japaneseName;

	@Column(name = "description")
	private String description;

	/** False for templates listed as "coming soon" — they have no tasks yet. */
	@Column(name = "is_available", nullable = false)
	private boolean available;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@OneToMany(mappedBy = "template", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sortOrder ASC")
	private List<ChecklistTask> tasks = new ArrayList<>();

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
