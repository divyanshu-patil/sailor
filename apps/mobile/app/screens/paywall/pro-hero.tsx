import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

/** The drawing's own canvas; everything below is in these units. */
const VIEW_W = 240;
const VIEW_H = 280;

const INK = "#17161B";
const GOLD = "#F6C443";
const GOLD_DEEP = "#E9AE2C";

/**
 * The Sailors Pro hero: the app's cream mascot, crowned, sitting on top of a
 * lavender podium with a crown flag behind it and peach steps leading up.
 *
 * Drawn flat, in the same hand as the rest of the app's mascots, in two
 * layers: the set, and the mascot on it — which bobs gently, so the screen is
 * alive without anything competing with the words beside it.
 */
const ProHero = memo(function ProHero({ width }: { width: number }) {
  const height = (width * VIEW_H) / VIEW_W;

  const bob = useSharedValue(0);
  useEffect(() => {
    bob.set(
      withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [bob]);
  const unit = height / VIEW_H;
  const float = useAnimatedStyle(() => ({
    transform: [{ translateY: -bob.value * 3.5 * unit }],
  }));

  return (
    <View style={{ width, height }} accessible={false}>
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Set />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, float]}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Mascot />
        </Svg>
      </Animated.View>
    </View>
  );
});

export default ProHero;

/** Rounded polygon: a same-colour stroke with round joins softens the
 *  corners the way the blocks' `rx` does. */
function Face({ d, fill }: { d: string; fill: string }) {
  return (
    <Path
      d={d}
      fill={fill}
      stroke={fill}
      strokeWidth={5}
      strokeLinejoin="round"
    />
  );
}

/** Everything that stays put: cloud, squiggle, blocks, steps and the flag. */
function Set() {
  return (
    <G>
      {/* Lavender cloud behind the flag. */}
      <Path
        d="M92 72 C 86 54, 106 42, 124 48 C 132 30, 164 28, 174 44 C 190 36, 214 46, 211 64 C 228 68, 226 92, 205 92 L 108 92 C 92 92, 85 82, 92 72 Z"
        fill="#E8E0FB"
      />
      {/* A loose loop of string, top right. */}
      <Path
        d="M168 22 C 182 6, 208 4, 209 17 C 210 28, 193 29, 196 16 C 199 4, 222 0, 238 9"
        stroke="#BBAAF3"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />

      {/* The block behind, running off the right edge. */}
      <Rect x={200} y={148} width={60} height={140} rx={12} fill="#F9D8CB" />
      <Rect x={200} y={148} width={60} height={14} rx={7} fill="#FCE6DD" />

      {/* Flag: pole, knob, cloth, and a crown on the cloth. */}
      <Rect x={187} y={40} width={5} height={150} rx={2.5} fill="#6D6875" />
      <Circle cx={189.5} cy={38} r={5} fill="#5B5763" />
      <Path
        d="M192 45 C 207 38, 221 51, 238 42 L 238 81 C 221 90, 207 77, 192 84 Z"
        fill="#9C85F2"
      />
      <Path
        d="M206 72 L 208 57 L 213.5 63 L 216.5 53 L 219.5 63 L 225 57 L 227 72 Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Peach steps up to the podium: the upper one first, behind. */}
      <Face d="M64 212 L 118 212 L 128 202 L 74 202 Z" fill="#FDE8CD" />
      <Rect x={62} y={211} width={58} height={80} rx={8} fill="#F8D5A9" />
      <Face d="M30 244 L 88 244 L 98 234 L 40 234 Z" fill="#FCE3C3" />
      <Rect x={28} y={243} width={62} height={48} rx={8} fill="#F6CD9E" />

      {/* The lavender podium the mascot sits on. */}
      <Face d="M202 197 L 214 185 L 214 276 L 202 290 Z" fill="#A088EC" />
      <Face d="M98 196 L 204 196 L 215 185 L 109 185 Z" fill="#CFC1F9" />
      <Rect x={96} y={195} width={108} height={96} rx={10} fill="#B6A1F3" />
      {/* Its soft highlight, top left of the front. */}
      <Rect
        x={104}
        y={203}
        width={40}
        height={6}
        rx={3}
        fill="#C7B6F7"
        opacity={0.9}
      />

      {/* The mascot's shadow on the podium top. */}
      <Ellipse cx={158} cy={193} rx={36} ry={5.5} fill="#7A62CC" opacity={0.28} />
    </G>
  );
}

/** The crowned mascot, with a few yellow sparks of excitement. */
function Mascot() {
  return (
    <G>
      <Defs>
        <RadialGradient id="body" cx="40%" cy="34%" r="70%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.55" stopColor="#F6F2EB" />
          <Stop offset="1" stopColor="#E7E0D5" />
        </RadialGradient>
      </Defs>

      {/* Sparks, off the crown's left. */}
      <G stroke={GOLD} strokeWidth={4.5} strokeLinecap="round">
        <Path d="M110 126 L 99 120" />
        <Path d="M116 115 L 109 104" />
        <Path d="M125 110 L 126 98" />
      </G>

      <Circle cx={158} cy={150} r={38} fill="url(#body)" />

      {/* Hands at its sides, feet out in front. */}
      <Ellipse
        cx={127}
        cy={172}
        rx={11.5}
        ry={9.5}
        fill={INK}
        transform="rotate(-28 127 172)"
      />
      <Ellipse
        cx={190}
        cy={174}
        rx={11.5}
        ry={9.5}
        fill={INK}
        transform="rotate(28 190 174)"
      />
      <Ellipse cx={145} cy={188} rx={10.5} ry={6.5} fill={INK} />
      <Ellipse cx={172} cy={189} rx={10.5} ry={6.5} fill={INK} />

      {/* Eyes. */}
      <Ellipse cx={149} cy={146} rx={5.5} ry={9} fill={INK} />
      <Ellipse cx={169} cy={148} rx={5.5} ry={9} fill={INK} />

      {/* The crown, set at a jaunty angle. */}
      <G transform="translate(-1 8) rotate(12 164 110)">
        <Path
          d="M141 121 L 144 98 L 154 108 L 163.5 90 L 173 108 L 183 98 L 186 121 Z"
          fill={GOLD}
          stroke={GOLD}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Rect x={140} y={116} width={47} height={9} rx={3.5} fill={GOLD_DEEP} />
        <Circle cx={144} cy={97} r={3.2} fill={GOLD} />
        <Circle cx={163.5} cy={88.5} r={3.4} fill={GOLD} />
        <Circle cx={183} cy={97} r={3.2} fill={GOLD} />
      </G>
    </G>
  );
}
