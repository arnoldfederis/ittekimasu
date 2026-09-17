import { ScrollView, Text } from "react-native";
import { STROKE_FONT_FAMILY, useStrokeFont } from "@/lib/stroke-font";

/**
 * A word with its stroke order drawn on it.
 *
 * The numbers are part of the glyphs, so this is a change of `fontFamily` and nothing else —
 * no path data, no per-character breakdown UI, and no way for a number to drift off the
 * stroke it labels.
 *
 * Big, and scrolling rather than shrinking. The font's own readme puts the floor for legible
 * numbers near 100pt, so a seven-kanji word squeezed onto one screen width would render the
 * thing the toggle exists to show as unreadable specks. Scrolling keeps every character at a
 * size the numbers survive, and a word short enough to fit simply sits centred.
 */
export function StrokeText({
  text,
  size,
  color,
}: {
  text: string;
  size: number;
  color: string;
}) {
  const ready = useStrokeFont(true);

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      <Text
        style={{
          // Before the face resolves this is the ordinary system rendering of the same word:
          // the characters are right, only the numbers are missing. Swapping a spinner in
          // would take the word off the screen for a frame instead.
          fontFamily: ready ? STROKE_FONT_FAMILY : undefined,
          fontSize: size,
          lineHeight: size * 1.25,
          color,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </ScrollView>
  );
}
