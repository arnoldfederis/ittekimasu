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

/** One day on which a user reviewed at least one card. See V14 for why this exists. */
@Entity
@Table(name = "user_study_days")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserStudyDay {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	/** The day in {@code ReviewService.APP_ZONE}, matching the streak columns on users. */
	@Column(name = "studied_on", nullable = false)
	private LocalDate studiedOn;

	@Column(name = "review_count", nullable = false)
	private int reviewCount;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;
}
