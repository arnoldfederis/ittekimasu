package app.ittekimasu.server.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * One kana's running totals from the device.
 *
 * <p>The glyph is only checked for BEING kana — one to three characters from the hiragana and
 * katakana blocks. The server deliberately holds no kana table (the chart ships in the client,
 * so adding a character is an app update, not a migration), which means it cannot say which
 * kana exist; it can still refuse to store arbitrary text.
 *
 * @param correct answers that were right; never more than {@code attempts}.
 * @param totalMs time spent answering this kana, summed across attempts.
 */
public record KanaProgressItemRequest(
    @NotNull @Pattern(regexp = "^[\\u3040-\\u30FF]{1,3}$", message = "must be kana") String glyph,
    @PositiveOrZero int correct,
    @PositiveOrZero int attempts,
    @PositiveOrZero long totalMs) {

  /** A device cannot have got more right than it answered. */
  @AssertTrue(message = "correct cannot exceed attempts")
  public boolean isCorrectWithinAttempts() {
    return correct <= attempts;
  }
}
