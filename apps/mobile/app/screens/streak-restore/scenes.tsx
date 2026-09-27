import { memo } from "react";
import Svg, {
  Circle,
  Ellipse,
  G,
  Path,
  Rect,
  type NumberProp,
} from "react-native-svg";

import SkiaMascot from "@/components/ui/skia-mascot";
import { STREAK_RESTORE_MASCOT } from "@/constants/mascots";

/**
 * The streak-restore scene (a `.lottie`), plus the SVG blob pieces the
 * cancel-subscription scene still draws itself from.
 */

export const INK = "#3A2418";
export const CREAM = "#F2E4D4";
const HEART = "#E8646B";
const HEART_DARK = "#C74F58";

/** The character every scene is built around: a round body, stub limbs, and a
 *  face that is two marks. Deliberately simple — the Lottie has a real one. */
export const Blob = memo(function Blob({
  cx,
  cy,
  r,
  fill,
  eyes = "open",
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  eyes?: "open" | "happy" | "sad" | "squint";
}) {
  const ex = r * 0.36;
  const ey = cy - r * 0.08;
  const es = r * 0.15;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={fill} />
      {eyes === "open" && (
        <>
          <Ellipse cx={cx - ex} cy={ey} rx={es} ry={es * 1.6} fill={INK} />
          <Ellipse cx={cx + ex} cy={ey} rx={es} ry={es * 1.6} fill={INK} />
        </>
      )}
      {eyes === "happy" && (
        <>
          <Path
            d={`M ${cx - ex - es} ${ey} q ${es} ${-es * 1.5} ${es * 2} 0`}
            stroke={INK}
            strokeWidth={es * 0.9}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={`M ${cx + ex - es} ${ey} q ${es} ${-es * 1.5} ${es * 2} 0`}
            stroke={INK}
            strokeWidth={es * 0.9}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      {eyes === "sad" && (
        <>
          <Path
            d={`M ${cx - ex - es} ${ey} q ${es} ${es * 1.5} ${es * 2} 0`}
            stroke={INK}
            strokeWidth={es * 0.9}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={`M ${cx + ex - es} ${ey} q ${es} ${es * 1.5} ${es * 2} 0`}
            stroke={INK}
            strokeWidth={es * 0.9}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      {eyes === "squint" && (
        <>
          <Path
            d={`M ${cx - ex - es} ${ey - es} l ${es * 2} ${es * 2} M ${cx - ex + es} ${ey - es} l ${-es * 2} ${es * 2}`}
            stroke={INK}
            strokeWidth={es * 0.8}
            strokeLinecap="round"
          />
          <Path
            d={`M ${cx + ex - es} ${ey - es} l ${es * 2} ${es * 2} M ${cx + ex + es} ${ey - es} l ${-es * 2} ${es * 2}`}
            stroke={INK}
            strokeWidth={es * 0.8}
            strokeLinecap="round"
          />
        </>
      )}
    </G>
  );
});

/** The cracked heart the two cream scenes are holding. */
export const BrokenHeart = memo(function BrokenHeart({
  x,
  y,
  w,
}: {
  x: number;
  y: number;
  w: number;
}) {
  const s = w / 100;
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      {/* Left half. */}
      <Path
        d="M48 16 C40 2, 14 2, 8 20 C2 38, 22 56, 48 76 Z"
        fill={HEART}
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* Right half, split along the same seam. */}
      <Path
        d="M52 16 C60 2, 86 2, 92 20 C98 38, 78 56, 52 76 Z"
        fill={HEART}
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <Path
        d="M40 22 C36 12, 20 12, 16 24"
        stroke="#F49AA0"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      {/* The plaster across the right half. */}
      <G transform="translate(62 34) rotate(-28)">
        <Rect
          x={-16}
          y={-7}
          width={32}
          height={14}
          rx={7}
          fill={CREAM}
          stroke={INK}
          strokeWidth={4}
        />
        <Circle cx={-5} cy={-2} r={1.6} fill={HEART_DARK} />
        <Circle cx={2} cy={2} r={1.6} fill={HEART_DARK} />
        <Circle cx={4} cy={-3} r={1.6} fill={HEART_DARK} />
      </G>
    </G>
  );
});

/** A stub arm or leg. */
export const Limb = memo(function Limb(props: {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotate?: NumberProp;
}) {
  const { x, y, rx, ry, rotate = 0 } = props;
  return (
    <Ellipse
      cx={x}
      cy={y}
      rx={rx}
      ry={ry}
      fill={INK}
      transform={`rotate(${rotate} ${x} ${y})`}
    />
  );
});

/**
 * Every streak-restore scene, from one `.lottie` whose string input `state`
 * picks the moment: `restore` (the ask), `restored` (the yellow win) and
 * `error` (a restore that is used up or no longer possible). One file, so the
 * cast, the cloud and the baseline are identical across the three.
 */
export const StreakRestoreScene = memo(function StreakRestoreScene({
  width,
  state,
}: {
  width: number;
  state: "restore" | "restored" | "error";
}) {
  return (
    <SkiaMascot
      source={STREAK_RESTORE_MASCOT.source}
      inputs={{ [STREAK_RESTORE_MASCOT.input]: state }}
      width={width}
      height={width * STREAK_RESTORE_MASCOT.aspect}
    />
  );
});

/**
 * The soft shapes in the bottom two corners.
 *
 * Part of the composition rather than decoration added later: the ask and the
 * capped screens both end on a lot of empty cream, and the reference closes it
 * with two blobs that the handwritten note at bottom-left then sits on.
 */
export const BottomBlobs = memo(function BottomBlobs({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 320 150" fill="none">
      <Path
        d="M-10 150 L-10 74 C16 50 62 44 92 66 C120 86 116 122 150 138 L150 150 Z"
        fill="#CFE0F7"
      />
      <Path
        d="M330 150 L330 58 C296 42 246 58 232 92 C222 116 236 136 250 150 Z"
        fill="#FBE7B0"
      />
      {/* No ticks here: they landed within a few points of the button's own
          sparks, and two sets of strokes in one place read as neither. */}
    </Svg>
  );
});
