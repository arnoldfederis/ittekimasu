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

/** One user's subscription state, written only by the RevenueCat webhook. */
@Entity
@Table(name = "entitlements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Entitlement {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, unique = true)
	private User user;

	@Column(name = "is_premium", nullable = false)
	private boolean premium;

	@Column(name = "revenuecat_customer_id")
	private String revenueCatCustomerId;

	/** End of the current period. Informational — {@link #premium} is what gates access. */
	@Column(name = "expires_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
	private Instant expiresAt;

	@Column(name = "last_event_type", length = 64)
	private String lastEventType;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
