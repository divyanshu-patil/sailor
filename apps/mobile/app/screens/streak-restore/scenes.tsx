import { memo } from "react";
import Svg, {
  Circle,
  Ellipse,
  G,
  Path,
  Rect,
  Text as SvgText,
  type NumberProp,
} from "react-native-svg";

/**
 * The three illustrations, drawn as SVG placeholders.
 *
 * TODO(lottie): every scene below is a stand-in for a .lottie that has not
 * landed yet. They are drawn rather than left as grey boxes so the layout,
 * the negative space and the eye line are all real — the file that replaces
 * each one has to fit the same box and sit on the same baseline.
 *
 * The wiring, when the files arrive, is the same as the auth screens':
 *
 *   import LottieView from "lottie-react-native";
 *   <LottieView source={BROKEN_STREAK} autoPlay loop style={{ width, height }} />
 *
 * Each component below takes only `width` and derives everything from it, so
 * swapping in a player that takes `{ width, height }` changes nothing above it.
 * Delete the SVG body, keep the wrapper and its size maths.
 *
 * Palette is passed in rather than imported: the same broken-heart scene is
 * drawn on cream in the ask state and greyed in the blocked one.
 */

const INK = "#3A2418";
const CREAM = "#F2E4D4";
const HEART = "#E8646B";
const HEART_DARK = "#C74F58";

/** The character every scene is built around: a round body, stub limbs, and a
 *  face that is two marks. Deliberately simple — the Lottie has a real one. */
const Blob = memo(function Blob({
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
const BrokenHeart = memo(function BrokenHeart({
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
const Limb = memo(function Limb(props: {
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
 * "Restore Your Streak?" — the cream scene.
 *
 * The centre character holds the cracked heart; friends crowd in from the right
 * and an hourglass sits on a pink blob to the left. The crowd is the point: the
 * broken streak is framed as something everyone is standing around, not as a
 * failure state.
 */
export const BrokenStreakScene = memo(function BrokenStreakScene({
  width,
  muted = false,
}: {
  width: number;
  /** The blocked state reuses this scene with its friends taken away. */
  muted?: boolean;
}) {
  const h = width * 0.62;
  return (
    <Svg width={width} height={h} viewBox="0 0 320 198" fill="none">
      {/* Cloud the whole cast sits on. */}
      <Path
        d="M0 198 L0 168 C10 148 44 142 58 160 C70 132 112 130 126 154 C140 128 188 128 200 156 C214 138 248 142 256 166 C268 150 300 154 306 172 L320 198 Z"
        fill="#F8F2E7"
      />

      {!muted && (
        <>
          {/* The crowd, right. Drawn first so the lead character overlaps them. */}
          <G opacity={0.98}>
            <Blob cx={288} cy={96} r={34} fill="#5FD0A4" eyes="open" />
            <Blob cx={272} cy={140} r={32} fill="#F8D66B" eyes="squint" />
            <Blob cx={296} cy={176} r={30} fill="#B99CF0" eyes="open" />
          </G>
          {/* Two small marks of surprise between the crowd and the lead. */}
          <Path
            d="M238 118 l8 -10 M244 128 l11 -5"
            stroke="#4A9BE8"
            strokeWidth={5}
            strokeLinecap="round"
          />
        </>
      )}

      {/* Hourglass on a pink blob, left. */}
      <G>
        <Blob cx={4} cy={166} r={40} fill="#F7B9CF" eyes="happy" />
        <G transform="translate(52 118)">
          <Rect
            x={0}
            y={0}
            width={44}
            height={9}
            rx={4.5}
            fill="#B9A3E8"
            stroke={INK}
            strokeWidth={4}
          />
          <Rect
            x={0}
            y={58}
            width={44}
            height={9}
            rx={4.5}
            fill="#B9A3E8"
            stroke={INK}
            strokeWidth={4}
          />
          <Path
            d="M6 9 C6 30 38 37 38 58 M38 9 C38 30 6 37 6 58"
            stroke={INK}
            strokeWidth={4}
            fill="#FFFDF7"
          />
          <Path d="M9 12 C11 28 33 34 35 12 Z" fill="#F5A623" />
          <Path d="M20 40 l3 16 h-3 z" fill="#F5A623" />
        </G>
      </G>

      {/* The lead: body behind, limbs over, heart in front of both. */}
      <Blob
        cx={160}
        cy={74}
        r={52}
        fill={CREAM}
        eyes={muted ? "sad" : "open"}
      />
      <Limb x={116} y={116} rx={20} ry={13} rotate={-32} />
      <Limb x={204} y={116} rx={20} ry={13} rotate={32} />
      <Limb x={132} y={156} rx={22} ry={14} rotate={-12} />
      <Limb x={190} y={156} rx={22} ry={14} rotate={12} />
      <BrokenHeart x={112} y={92} w={96} />

      {!muted && (
        <>
          {/* The pink exclamation strokes and the scribble, from the design. */}
          <Path
            d="M118 22 l-6 -20 M136 14 l-2 -20"
            stroke="#F58BB0"
            strokeWidth={8}
            strokeLinecap="round"
          />
          <Path
            d="M224 62 c-14 -14 14 -26 20 -10 c5 13 -18 18 -22 6 c-4 -13 18 -16 20 -4 c2 9 -12 12 -14 4"
            stroke="#4A2B1E"
            strokeWidth={3}
            fill="none"
          />
        </>
      )}
    </Svg>
  );
});

/**
 * "Streak Restored!" — the yellow scene.
 *
 * The same character, upright and walking, holding the flame overhead. The
 * broken heart is gone rather than mended: the reward for restoring is the
 * streak itself, and a repaired heart would put the damage back on screen.
 */
export const RestoredScene = memo(function RestoredScene({
  width,
}: {
  width: number;
}) {
  const h = width * 0.78;
  return (
    <Svg width={width} height={h} viewBox="0 0 300 234" fill="none">
      {/* The rays, fanned around the flame. */}
      <G stroke="#F5A623" strokeWidth={9} strokeLinecap="round">
        <Path d="M214 44 l6 -30" />
        <Path d="M246 58 l22 -20" />
        <Path d="M258 92 l30 -6" />
        <Path d="M186 30 l-4 -24" opacity={0.85} />
        <Path d="M120 44 l-12 -26" opacity={0.7} />
        <Path d="M92 64 l-24 -14" opacity={0.7} />
        <Path d="M78 96 l-28 -4" opacity={0.55} />
      </G>

      {/* Confetti. */}
      <Path
        d="M56 132 q10 -10 20 0 q10 10 20 0"
        stroke="#F58BB0"
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M236 148 q10 -10 20 0 q10 10 20 0"
        stroke="#F2994A"
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M44 84 l7 -14 l7 14 l14 7 l-14 7 l-7 14 l-7 -14 l-14 -7 z"
        fill="#FFFFFF"
      />
      <Path
        d="M258 124 l6 -12 l6 12 l12 6 l-12 6 l-6 12 l-6 -12 l-12 -6 z"
        fill="#F7D046"
      />
      <Path
        d="M36 168 l5 -10 l5 10 l10 5 l-10 5 l-5 10 l-5 -10 l-10 -5 z"
        fill="#FFFFFF"
      />

      {/* Ground shadow, so the walk has a floor. */}
      <Ellipse
        cx={150}
        cy={214}
        rx={62}
        ry={12}
        fill="#F2C94C"
        opacity={0.55}
      />

      {/* Legs mid-stride, drawn under the body. */}
      <Limb x={118} y={196} rx={26} ry={14} rotate={-28} />
      <Limb x={186} y={198} rx={26} ry={14} rotate={26} />

      <Blob cx={150} cy={122} r={52} fill="#FFFDF5" eyes="happy" />

      {/* Left arm swinging back, right arm raised with the flame. */}
      <Limb x={100} y={150} rx={22} ry={13} rotate={38} />
      <Limb x={200} y={96} rx={22} ry={13} rotate={-52} />

      {/* The flame, held overhead. */}
      <G transform="translate(196 18) scale(1.05)">
        <Path
          d="M30 0 C42 18 56 26 56 46 C56 66 44 78 28 78 C12 78 0 66 0 48 C0 32 14 24 18 10 C22 18 26 14 30 0 Z"
          fill="#F4682B"
          stroke={INK}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <Path
          d="M30 30 C38 42 44 48 44 58 C44 68 37 74 29 74 C21 74 15 68 15 58 C15 48 24 44 30 30 Z"
          fill="#FBD24B"
        />
      </G>
    </Svg>
  );
});

/**
 * "You've already used your restore" — the capped scene.
 *
 * The broken-heart character again, with its friends and its exclamation marks
 * removed and a calendar set beside it. Reusing the scene is deliberate: this
 * is the same predicament as the ask screen, minus the way out.
 */
export const BlockedScene = memo(function BlockedScene({
  width,
  used,
  allowed,
}: {
  width: number;
  used: number;
  allowed: number;
}) {
  const h = width * 0.62;
  return (
    <Svg width={width} height={h} viewBox="0 0 320 198" fill="none">
      <Path
        d="M0 198 L0 168 C10 148 44 142 58 160 C70 132 112 130 126 154 C140 128 188 128 200 156 C214 138 248 142 256 166 C268 150 300 154 306 172 L320 198 Z"
        fill="#F8F2E7"
      />

      {/* The calendar, propped on the left. Dropped below the handwritten note
          that points at it — at its old height the two sat on top of each
          other. */}
      <G transform="translate(4 86)">
        <Rect
          x={0}
          y={10}
          width={120}
          height={100}
          rx={8}
          fill="#FFFDF7"
          stroke={INK}
          strokeWidth={5}
        />
        <Path
          d="M24 10 v-14 M94 10 v-14"
          stroke={INK}
          strokeWidth={7}
          strokeLinecap="round"
        />
        {/* The cap written out. The tiles on their own read as decoration. */}
        <SvgText
          x={60}
          y={40}
          fontSize={14}
          fontWeight="bold"
          fill={INK}
          textAnchor="middle"
        >
          Restores
        </SvgText>
        <SvgText
          x={60}
          y={57}
          fontSize={14}
          fontWeight="bold"
          fill={INK}
          textAnchor="middle"
        >
          this month
        </SvgText>
        {/* `used` filled, the remainder empty. */}
        <G transform="translate(22 66)">
          <Rect
            x={0}
            y={0}
            width={30}
            height={34}
            rx={5}
            fill={used >= 1 ? "#F7B9CF" : "#EFEFEF"}
          />
          <SvgText
            x={15}
            y={26}
            fontSize={21}
            fontWeight="bold"
            fill={INK}
            textAnchor="middle"
          >
            {String(used)}
          </SvgText>
          <Path
            d="M40 4 l10 30"
            stroke={INK}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Rect x={46} y={0} width={30} height={34} rx={5} fill="#EFEFEF" />
          <SvgText
            x={61}
            y={26}
            fontSize={21}
            fontWeight="bold"
            fill={INK}
            textAnchor="middle"
          >
            {String(allowed)}
          </SvgText>
        </G>
      </G>

      <Blob cx={188} cy={74} r={52} fill={CREAM} eyes="sad" />
      <Limb x={144} y={116} rx={20} ry={13} rotate={-32} />
      <Limb x={232} y={116} rx={20} ry={13} rotate={32} />
      <Limb x={160} y={156} rx={22} ry={14} rotate={-12} />
      <Limb x={218} y={156} rx={22} ry={14} rotate={12} />
      <BrokenHeart x={140} y={92} w={96} />

      <Path
        d="M146 22 l-6 -20 M164 14 l-2 -20"
        stroke="#F58BB0"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <Path
        d="M258 76 c-14 -14 14 -26 20 -10 c5 13 -18 18 -22 6 c-4 -13 18 -16 20 -4 c2 9 -12 12 -14 4"
        stroke="#4A2B1E"
        strokeWidth={3}
        fill="none"
      />
    </Svg>
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
