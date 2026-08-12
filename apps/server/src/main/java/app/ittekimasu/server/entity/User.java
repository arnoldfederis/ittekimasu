package app.ittekimasu.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CurrentTimestamp;

import java.time.Instant;
import java.util.UUID;

import static org.hibernate.generator.EventType.INSERT;
import static org.hibernate.generator.EventType.UPDATE;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "firebase_uid")
	private String firebaseUid;

	private String email;

	private String name;

	@Column(name = "created_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
	@CurrentTimestamp(event = INSERT)
	private Instant createdAt;

	@Column(name = "updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
	@CurrentTimestamp(event = {INSERT, UPDATE})
	private Instant updatedAt;
}
