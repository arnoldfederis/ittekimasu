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

/**
 * One kana's quiz record in a Pro user's backup. See V17 for why this is a backup rather than
 * the source of truth.
 *
 * <p>Read through JPA, written only by the native upsert in {@code UserKanaProgressRepository}:
 * the merge rule (keep the larger of each value) has to hold even when two uploads race, and
 * only Postgres can settle that in one statement.
 */
@Entity
@Table(name = "user_kana_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserKanaProgress {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	/** The character as shown, which also says which script: ぢゃ and ヂャ are two rows. */
	@Column(name = "glyph", nullable = false, length = 3)
	private String glyph;

	@Column(name = "correct_count", nullable = false)
	private int correctCount;

	@Column(name = "attempt_count", nullable = false)
	private int attemptCount;

	@Column(name = "total_answer_ms", nullable = false)
	private long totalAnswerMs;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
