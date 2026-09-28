package app.ittekimasu.server.dto.response;

import app.ittekimasu.server.entity.UserKanaProgress;

/** One kana in a Pro user's backup. Same shape the device sends, so it can merge it straight in. */
public record KanaProgressResponse(String glyph, int correct, int attempts, long totalMs) {

  public static KanaProgressResponse from(UserKanaProgress progress) {
    return new KanaProgressResponse(
        progress.getGlyph(),
        progress.getCorrectCount(),
        progress.getAttemptCount(),
        progress.getTotalAnswerMs());
  }
}
