package app.ittekimasu.server.service;

import app.ittekimasu.server.dto.request.KanaProgressItemRequest;
import app.ittekimasu.server.dto.response.KanaProgressResponse;
import app.ittekimasu.server.exception.PaymentRequiredException;
import app.ittekimasu.server.repository.UserKanaProgressRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Pro backup of the kana quiz. The device holds every learner's progress; this only keeps
 * a copy for subscribers, so a reinstall or a new phone can restore it.
 *
 * <p>Both directions are Pro: the backup is the perk, and restoring it is part of the backup.
 * The check is here, against the entitlement table, never a flag from the client — the same
 * rule as every other premium gate. A lapsed subscriber's rows are kept, not deleted: they
 * come back if the subscription does.
 */
@Service
public class KanaProgressService {

  private final UserKanaProgressRepository repository;
  private final EntitlementService entitlementService;

  public KanaProgressService(
      UserKanaProgressRepository repository, EntitlementService entitlementService) {
    this.repository = repository;
    this.entitlementService = entitlementService;
  }

  @Transactional(readOnly = true)
  public List<KanaProgressResponse> list(UUID userId) {
    requirePremium(userId);
    return read(userId);
  }

  /**
   * Folds a device snapshot into the backup and returns the merged whole.
   *
   * <p>Returning the merge, not an acknowledgement, lets the device adopt anything the server
   * held that it did not — the other phone's progress, or a backup restored before this one
   * finished loading.
   */
  @Transactional
  public List<KanaProgressResponse> sync(UUID userId, List<KanaProgressItemRequest> items) {
    requirePremium(userId);
    for (KanaProgressItemRequest item : items) {
      repository.mergeLargest(
          userId, item.glyph(), item.correct(), item.attempts(), item.totalMs());
    }
    return read(userId);
  }

  private List<KanaProgressResponse> read(UUID userId) {
    return repository.findAllByUserIdOrderByGlyphAsc(userId).stream()
        .map(KanaProgressResponse::from)
        .toList();
  }

  private void requirePremium(UUID userId) {
    if (!entitlementService.isPremium(userId)) {
      throw new PaymentRequiredException("Backing up kana progress is part of Pro.");
    }
  }
}
