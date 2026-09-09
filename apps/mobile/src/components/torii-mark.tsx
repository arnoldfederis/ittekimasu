import Svg, { Path, Rect } from "react-native-svg";
import {
  CHECK,
  GATE_PATHS,
  MARK_CANVAS,
  MARK_COLORS,
  NUKI,
} from "@/constants/brand-mark";

type ToriiMarkProps = {
  size: number;
  /** The gate. Defaults to the mark's cream. */
  gate?: string;
  /**
   * The check. Defaults to the mark's amber; pass the same value as `gate` for a flat
   * silhouette, which is what the backdrop wants — two tones at 6% opacity read as a
   * smudge rather than as a second colour.
   */
  check?: string;
  opacity?: number;
};

/**
 * The app's mark, drawn rather than rasterised.
 *
 * The geometry comes from `constants/brand-mark.ts`, which the icon generator reads too —
 * so the torii behind the sign-in screen is the same torii on the home screen, and stays
 * that way when the artwork changes. Rendering it as vector also means it can be blown up
 * to 500pt as a backdrop without shipping a 500pt PNG for it.
 */
export function ToriiMark({
  size,
  gate = MARK_COLORS.cream,
  check = MARK_COLORS.amber,
  opacity = 1,
}: ToriiMarkProps) {
  return (
    <Svg
      height={size}
      opacity={opacity}
      viewBox={`0 0 ${MARK_CANVAS} ${MARK_CANVAS}`}
      width={size}
    >
      {GATE_PATHS.map((d) => (
        <Path d={d} fill={gate} key={d} />
      ))}
      <Rect
        fill={gate}
        height={NUKI.height}
        rx={NUKI.rx}
        width={NUKI.width}
        x={NUKI.x}
        y={NUKI.y}
      />
      <Path
        d={CHECK.d}
        fill="none"
        stroke={check}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={CHECK.strokeWidth}
      />
    </Svg>
  );
}
