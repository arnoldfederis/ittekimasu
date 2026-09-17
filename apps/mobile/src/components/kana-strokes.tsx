import { memo, useMemo } from "react";
import Svg, { G, Path, Text as SvgText } from "react-native-svg";
import {
  KANA_STROKE_VIEWBOX,
  KANA_STROKES,
  type KanaStroke,
} from "@/constants/kana-strokes";
import { useThemeColors } from "@/constants/theme";

/**
 * Half the space a number needs to stay off the edge and off its neighbours, as a share of
 * its own size. A bare number needs far less room than the disc that used to sit behind it,
 * which is why the markers sit close to the strokes they label.
 */
const MARKER_RADIUS_RATIO = 0.52;

/** Clear air between two numbers, so adjacent ones still read as two. */
const MARKER_GAP_RATIO = 0.13;

/**
 * How much of a digit's em is actually inked, so a size in points means the same thing on
 * both halves of the app.
 *
 * `STROKE_NUMBER_POINTS` is the HEIGHT OF THE DIGIT, because that is the only thing you can
 * measure on the kanji side — the numbers are contours baked into a glyph, so the font's
 * ratio was read off the ink. Setting `fontSize` to that number here instead made every kana
 * number about a third short: a digit only fills its cap height, roughly 0.72 em, and the rest
 * of the em is the leading nobody can see. Divide it back out and the two match.
 */
const DIGIT_CAP_RATIO = 0.72;

/**
 * The halo that keeps a number readable where it sits, which is on top of its own stroke.
 *
 * Both are ink — the number and the thing it labels — so `1` on あ's opening bar was black on
 * black and simply not there. The number cannot move off the stroke without lying about where
 * the stroke begins, so the background is painted around it instead: only where the digit
 * needs it, no chip and no disc, the same trick a map label uses to sit on a coastline. Half
 * the width lands outside the contour, which is why this is larger than it looks.
 *
 * It is painted in `surface` because the only place this renders is the kana sheet's card,
 * which is `bg-surface`. Move the diagram onto another background and the halo has to follow.
 */
const MARKER_HALO_RATIO = 0.34;

/**
 * Medium, matching the stroke-order font's own numbers.
 *
 * It was 700 while the numbers were fighting the strokes underneath them for legibility. With
 * the halo doing that job, bold is just a second thing making the kana half look unlike the
 * kanji half.
 */
const MARKER_FONT_WEIGHT = "500";

/**
 * How to write one kana: the whole character, with each stroke numbered where it begins.
 *
 * This was an animation first, and the animation was the wrong shape for the screen it is
 * on. The kana chart is a REFERENCE — you come to it to check something and leave — and an
 * animation makes you wait for an answer a diagram simply states. あ took nearly three
 * seconds to draw itself, during which the thing you opened the sheet to look at was
 * incomplete, and there was no way to read it faster, scan back to stroke two, or take it in
 * at a glance. A numbered diagram is the form every kana worksheet and dictionary already
 * uses, it is legible the instant the sheet opens, and it survives a screenshot.
 *
 * Dropping it also dropped the whole machine underneath: reanimated, a dasharray reveal
 * (and its round-cap artefacts), a per-path length in the bundle, the build dependency that
 * computed those lengths, and the page-tracking the sheet needed to decide which card was
 * allowed to animate.
 *
 * A yōon is two characters, numbered straight through: き's four strokes, then ゃ's three.
 * That is the order they are written in, and it falls out of laying two 1024 boxes side by
 * side rather than needing a special case.
 *
 * Memoised on its four primitive props, because this is the most expensive thing the kana
 * sheet draws — a couple of dozen SVG nodes per glyph — and the sheet's list re-renders its
 * pages whenever anything they depend on moves, revealing a reading included.
 */
export const KanaStrokes = memo(function KanaStrokes({
  glyph,
  maxWidth,
  height,
  numberPoints,
}: {
  glyph: string;
  maxWidth: number;
  height: number;
  /** On-screen HEIGHT of a stroke number, so kana and kanji agree. See lib/stroke-font.ts. */
  numberPoints: number;
}) {
  const colors = useThemeColors();

  const characters = useMemo(() => [...glyph], [glyph]);

  /** Flattened across the character(s), so numbering runs 1..n over the whole syllable. */
  const strokes = useMemo(() => {
    const flat: { stroke: KanaStroke; offsetX: number }[] = [];

    characters.forEach((char, index) => {
      for (const stroke of KANA_STROKES[char] ?? []) {
        flat.push({ stroke, offsetX: index * KANA_STROKE_VIEWBOX });
      }
    });

    return flat;
  }, [characters]);

  const width = KANA_STROKE_VIEWBOX * characters.length;

  // Two characters need twice the width. Shrink rather than overflow, so きゃ and か occupy
  // the same box and paging between them does not resize the card.
  const side = Math.min(height, maxWidth / characters.length);

  /*
   * The marker is specified in POINTS but drawn in viewBox units, so it has to be converted
   * against however big this glyph ended up. Fixing it in viewBox units instead would make
   * the number grow and shrink with the card, which is exactly how it drifted away from the
   * kanji size in the first place.
   */
  const markerInk = side > 0 ? numberPoints * (KANA_STROKE_VIEWBOX / side) : 0;
  const markerFontSize = markerInk / DIGIT_CAP_RATIO;
  const markerHalo = markerInk * MARKER_HALO_RATIO;

  // Measured off the INK, not the em: what has to clear the edge and the neighbouring number
  // is the part of the digit you can see, plus the halo drawn around it.
  const markerRadius = markerInk * MARKER_RADIUS_RATIO + markerHalo / 2;

  /*
   * Where the numbers actually go, which is not always where the strokes start.
   *
   * A dakuten is two flicks a few dozen units apart (び, ぱ, ご — a quarter of the chart), so
   * numbers set honestly on both of them overlap almost completely and the lower one
   * disappears under the higher. Nudged apart they are still unmistakably on the marks they
   * label, and both are readable, which is the entire job of a numbered diagram.
   */
  const markers = placeMarkers(
    strokes.map(({ stroke, offsetX }) => [
      stroke.start[0] + offsetX,
      stroke.start[1],
    ]),
    width,
    markerRadius,
    markerInk * MARKER_GAP_RATIO,
  );

  if (strokes.length === 0) return null;

  return (
    <Svg
      height={side}
      viewBox={`0 0 ${KANA_STROKE_VIEWBOX * characters.length} ${KANA_STROKE_VIEWBOX}`}
      width={side * characters.length}
    >
      {/*
        The character itself. Each stroke's outline filled in ink — together they ARE the
        finished glyph, so there is no second copy of it to draw or keep in step.
      */}
      {strokes.map(({ stroke, offsetX }, strokeIndex) => (
        <G key={`stroke-${strokeIndex}`} x={offsetX}>
          {stroke.outlines.map((d, outlineIndex) => (
            <Path
              d={d}
              fill={colors.ink}
              key={`stroke-${strokeIndex}-${outlineIndex}`}
            />
          ))}
        </G>
      ))}

      {/*
        The numbers go on last so no stroke is drawn over them. They are the content here:
        without them this is just the character, which the sheet already shows.
      */}
      {markers.map(([cx, cy], strokeIndex) => {
        // SVG text sits on its baseline, and react-native-svg has no reliable
        // dominant-baseline on both platforms — dropping it half a digit height centres the
        // number on its point.
        const baseline = cy + markerInk / 2;

        return (
          <G key={`marker-${strokeIndex}`}>
            {/*
              The background, painted in the shape of the number and a little wider, so the
              digit reads against the stroke it is sitting on. Filled as well as stroked:
              stroking alone leaves 4's counter showing the black stroke through the middle of
              the number.
            */}
            <SvgText
              fill={colors.surface}
              fontSize={markerFontSize}
              fontWeight={MARKER_FONT_WEIGHT}
              stroke={colors.surface}
              strokeWidth={markerHalo}
              textAnchor="middle"
              x={cx}
              y={baseline}
            >
              {strokeIndex + 1}
            </SvgText>
            <SvgText
              // Ink, not the brand colour. The kanji numbers are contours inside a glyph and
              // render in whatever colour the strokes do — a font cannot paint them separately
              // — so tinting only the kana ones made the two halves of one feature look
              // unrelated.
              fill={colors.ink}
              fontSize={markerFontSize}
              fontWeight={MARKER_FONT_WEIGHT}
              textAnchor="middle"
              x={cx}
              y={baseline}
            >
              {strokeIndex + 1}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
});

function clamp(value: number, inset: number, extent: number) {
  return Math.min(Math.max(value, inset), extent - inset);
}

/**
 * Lay the numbers out so none of them hides another.
 *
 * Each marker starts on its stroke's first point, pulled inside the box — あ's second stroke
 * starts at y=37, so a number set honestly there loses its top off the edge, and a clipped
 * marker just looks broken. Then each one in turn is pushed directly away from any
 * already-placed number it overlaps, until it is clear.
 *
 * Placed in stroke order and only ever moving the LATER marker, so the numbers stay where
 * the reader expects: 1 sits exactly on the first stroke, and it is 4 that gives ground to
 * 3 rather than the two meeting somewhere in between. A handful of passes is plenty for the
 * five-stroke worst case; the loop exits as soon as nothing moved.
 */
function placeMarkers(
  points: [number, number][],
  extent: number,
  radius: number,
  gap: number,
): [number, number][] {
  const minDistance = radius * 2 + gap;
  const placed: [number, number][] = [];

  for (const [startX, startY] of points) {
    let x = clamp(startX, radius, extent);
    let y = clamp(startY, radius, KANA_STROKE_VIEWBOX);

    for (let pass = 0; pass < 8; pass++) {
      let moved = false;

      for (const [otherX, otherY] of placed) {
        const dx = x - otherX;
        const dy = y - otherY;
        const distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;

        // Two strokes can begin at the very same point; nudge sideways rather than divide
        // by zero, and the next pass settles it.
        const unitX = distance === 0 ? 1 : dx / distance;
        const unitY = distance === 0 ? 0 : dy / distance;
        const push = minDistance - distance;

        x = clamp(x + unitX * push, radius, extent);
        y = clamp(y + unitY * push, radius, KANA_STROKE_VIEWBOX);
        moved = true;
      }

      if (!moved) break;
    }

    placed.push([x, y]);
  }

  return placed;
}
