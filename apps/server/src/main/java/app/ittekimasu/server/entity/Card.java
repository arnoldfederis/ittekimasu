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

/** One prompt/answer pair. Front is the word as written, back is "reading · meaning". */
@Entity
@Table(name = "cards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Card {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "course_id", nullable = false)
	private Course course;

	@Column(name = "front_text", nullable = false)
	private String frontText;

	@Column(name = "back_text", nullable = false, length = 500)
	private String backText;

	@Enumerated(EnumType.STRING)
	@Column(name = "card_type", nullable = false, length = 32)
	private CardType cardType;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
