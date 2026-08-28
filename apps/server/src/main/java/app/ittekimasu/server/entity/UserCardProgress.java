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

/**
 * One learner's SM-2 state for one card. Created on the first review, never before — an
 * unreviewed card is represented by the absence of a row.
 */
@Entity
@Table(name = "user_card_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserCardProgress {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "card_id", nullable = false)
	private Card card;

	@Column(name = "ease_factor", nullable = false)
	private double easeFactor;

	@Column(name = "interval_days", nullable = false)
	private int intervalDays;

	@Column(name = "next_review_date", nullable = false)
	private LocalDate nextReviewDate;

	/** Consecutive non-AGAIN answers for this card. Reset to 0 by AGAIN. */
	@Column(name = "streak_count", nullable = false)
	private int streakCount;

	@Column(name = "last_reviewed_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	private Instant lastReviewedAt;

	/** The most recent answer. Null only for rows written before the undo snapshot existed. */
	@Enumerated(EnumType.STRING)
	@Column(name = "last_rating", length = 16)
	private ReviewRating lastRating;

	/*
	 * The state this row held before the most recent review, so one answer can be taken back.
	 * All null together, and null across the board means there is nothing to undo.
	 */

	@Column(name = "previous_ease_factor")
	private Double previousEaseFactor;

	@Column(name = "previous_interval_days")
	private Integer previousIntervalDays;

	@Column(name = "previous_streak_count")
	private Integer previousStreakCount;

	@Column(name = "previous_next_review_date")
	private LocalDate previousNextReviewDate;

	/**
	 * Null when the review being undone was the FIRST for this card — there was no earlier
	 * state, so undoing it means deleting the row and returning the card to "unseen".
	 */
	@Column(name = "previous_last_reviewed_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
	private Instant previousLastReviewedAt;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
