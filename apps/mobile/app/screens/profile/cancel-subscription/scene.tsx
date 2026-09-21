import { memo } from "react";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

import { Blob, BrokenHeart, Limb } from "@/screens/streak-restore/scenes";

/**
 * The character, sitting down and crying, under a cracked heart.
 *
 * Built from the restore flow's own parts — the same body, the same broken
 * heart, the same clouds — so the two screens are visibly the same hand. What
 * is different is the pose: the restore screen's character is standing among
 * friends, because a broken streak is a shared, fixable thing. Here it is
 * alone and sitting, which is the whole difference between "bring it back" and
 * "are you sure?".
 *
 * SVG rather than a Lottie for the same reason the restore scenes are: the
 * animation has not landed yet, and a drawing that occupies the right box
 * tells the layout the truth in the meantime.
 */
export const CancelScene = memo(function CancelScene({
  width,
}: {
  width: number;
}) {
  const height = width * 0.62;
  return (
    <Svg width={width} height={height} viewBox="0 0 320 198" fill="none">
      {/* The halo the character sits in front of, then the clouds either
          side of it. */}
      <Circle cx={160} cy={106} r={70} fill="#F3E7D5" />
      <Path
        d="M0 198 L0 168 C10 148 44 142 58 160 C70 132 112 130 126 154 C140 128 188 128 200 156 C214 138 248 142 256 166 C268 150 300 154 306 172 L320 198 Z"
        fill="#F8F2E7"
      />

      {/* Cracked heart, up and to the left, with the strokes that give it
          somewhere to have come from. */}
      <BrokenHeart x={84} y={8} w={76} />
      <Path
        d="M74 34 l-14 -12 M82 16 l-8 -14"
        stroke="#F58BB0"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <Path
        d="M178 26 l4 -20 M194 36 l14 -14"
        stroke="#F5C54A"
        strokeWidth={8}
        strokeLinecap="round"
      />

      {/* The scribble of confusion, top right. */}
      <Path
        d="M252 54 c-16 -16 16 -30 23 -11 c6 15 -21 21 -25 7 c-5 -15 21 -18 23 -5 c2 10 -14 14 -16 5"
        stroke="#6B6B72"
        strokeWidth={4}
        fill="none"
      />

      {/* The lead, sitting. Its body is a shade lighter than the halo behind
          it — in cream on cream the character disappeared and left a pair of
          eyes floating on the page. */}
      <Blob cx={160} cy={104} r={50} fill="#FFFCF5" eyes="sad" />
      <Ellipse cx={140} cy={118} rx={5} ry={7} fill="#5FA8F0" />
      <Ellipse cx={180} cy={118} rx={5} ry={7} fill="#5FA8F0" />

      {/* Arms drawn up to the face, knees pulled in. Spread wide enough to
          read as four limbs rather than one dark mass. */}
      <Limb x={112} y={130} rx={19} ry={12} rotate={-48} />
      <Limb x={208} y={130} rx={19} ry={12} rotate={48} />
      <Limb x={132} y={172} rx={24} ry={12} rotate={-10} />
      <Limb x={190} y={172} rx={24} ry={12} rotate={10} />

      {/* The ground it is sitting on. */}
      <G opacity={0.45}>
        <Ellipse cx={161} cy={187} rx={66} ry={9} fill="#EADCC8" />
      </G>
    </Svg>
  );
});
