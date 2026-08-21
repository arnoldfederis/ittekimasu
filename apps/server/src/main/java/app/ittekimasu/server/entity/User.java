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

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = EventType.INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE", nullable = false)
	@CurrentTimestamp(event = {EventType.INSERT, EventType.UPDATE})
	private Instant updatedAt;
}
