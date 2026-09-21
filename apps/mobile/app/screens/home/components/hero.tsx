import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Icon from "@react-native-vector-icons/lucide";
import Svg, { Ellipse, Path } from "react-native-svg";

import { HandwrittenNote } from "@/components/ui/handwritten-note";

import {
  cloudDrift,
  homeColors,
  homeFonts,
  homeRadius,
  streakDisplay,
} from "../theme";
import { StreakIcon, type StreakStatus } from "./streak-icons";
import PressableScale from "@/components/ui/animated/PressableScale";

/**
 * The orange hero.
 *
 * Full-bleed at the top (it runs behind the status bar) and rounded only at the
 * bottom, so it reads as the screen's own sky rather than as the first card in
 * a list. Everything in it is positioned as a fraction of its width, because the
 * design is one composition — the mascot has to sit between two specific clouds
 * at any screen size, and points tuned on a 6.9" phone put it in the wrong cloud
 * on a 6.1" one.
 */

/** Hero height as a multiple of its width, excluding the status-bar inset. */
const HERO_RATIO = 0.86;
/** How much of the hero the cloud/mascot scene occupies, from the bottom. */
const SCENE_RATIO = 0.5;

export const heroHeight = (width: number) => width * HERO_RATIO;

/** Two lumpy silhouettes, sharing a viewBox so they can be layered and drifted
 *  independently. Wider than 400 at both ends so a drifting cloud never
 *  exposes the hero behind its edge. */
const CLOUD_BACK =
  "M0 180 L0 112 C4 64 58 48 84 92 C98 36 170 24 198 76 " +
  "C216 28 290 30 306 86 C324 44 382 56 400 98 L400 180 Z";
const CLOUD_FRONT =
  "M0 180 L0 120 C6 84 46 74 64 104 C72 52 124 40 146 86 C162 30 224 26 240 84 " +
  "C254 40 302 50 312 100 C326 66 368 74 376 112 C384 94 396 100 400 124 L400 180 Z";

/**
 * The placeholder mascot: a grey blob with blank limbs.
 *
 * Deliberately featureless beyond two eyes — this is a hole shaped like the
 * Lottie that replaces it, and the geometry here (size, centre, how far the
 * body clears the front cloud) is what that Lottie has to land in.
 *
 * Drawn in two pieces because the cloud goes between them: the body is behind
 * the front cloud, the limbs drape over it.
 */
export type MascotMood = "neutral" | "sad";

const MascotBody = memo(function MascotBody({
  size,
  mood,
}: {
  size: number;
  mood: MascotMood;
}) {
  // TODO(lottie): swap the SVG below for the real mascot once its .lottie
  // lands. The player is the same one the auth screens use, so the wiring is:
  //
  //   import LottieView from "lottie-react-native";
  //   import { BLOB_CREAM_MASCOT } from "@/constants/mascots";
  //
  //   <LottieView
  //     source={mood === "sad" ? BLOB_SAD_MASCOT : BLOB_CREAM_MASCOT}
  //     autoPlay
  //     loop
  //     style={{ width: size, height: size }}
  //   />
  //
  // `mood` maps to the file, or to a boolean input on one file's state machine
  // (see components/ui/mascot.tsx for that shape) — either way the call site
  // keeps passing `mood` and nothing above here changes.
  // Note the limbs below go away with it — the real file animates its own —
  // and `MascotLimbs` should be deleted rather than left drawing over it.
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 120 144" fill="none">
      {/* The two yellow ticks above the head, from the design. */}
      <Path
        d="M50 22 L47 9"
        stroke={homeColors.spark}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <Path
        d="M70 21 L71 8"
        stroke={homeColors.spark}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <Ellipse cx="60" cy="88" rx="53" ry="55" fill={homeColors.mascot} />
      {mood === "sad" ? (
        <>
          {/* Downturned arcs, not ovals. Two curves say "sad" at any size,
              where a mouth or eyebrows turn to mush when the Lottie replaces
              this and the real character has its own face. */}
          <Path
            d="M34 74 C39 63, 49 63, 54 74"
            stroke={homeColors.mascotInk}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M67 74 C72 63, 82 63, 87 74"
            stroke={homeColors.mascotInk}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
          {/* No tear: the front cloud's edge sits about 25pt below the eyes,
              so anything on the cheek is swallowed by it. The arcs carry the
              mood on their own, and the Lottie that replaces this face is free
              to do more with the room it has. */}
        </>
      ) : (
        <>
          <Ellipse
            cx="45"
            cy="86"
            rx="10"
            ry="15"
            fill={homeColors.mascotInk}
          />
          <Ellipse
            cx="76"
            cy="86"
            rx="10"
            ry="15"
            fill={homeColors.mascotInk}
          />
        </>
      )}
    </Svg>
  );
});

/**
 * The blank limbs, drawn over the front cloud so the mascot leans on it.
 *
 * One SVG spanning both flanks rather than two placed views: the gap between
 * them is the mascot's width, and keeping that relationship inside a single
 * viewBox means the pair scales with the body instead of drifting apart on a
 * narrower phone.
 */
const MascotLimbs = memo(function MascotLimbs({ width }: { width: number }) {
  return (
    <Svg width={width} height={width * 0.2} viewBox="0 0 200 40" fill="none">
      <Ellipse
        cx="30"
        cy="20"
        rx="27"
        ry="13"
        fill={homeColors.mascotInk}
        transform="rotate(-9 30 20)"
      />
      <Ellipse
        cx="170"
        cy="20"
        rx="27"
        ry="13"
        fill={homeColors.mascotInk}
        transform="rotate(9 170 20)"
      />
    </Svg>
  );
});

/**
 * [COMMENT LATER]
 * The cartoon restore button, floated on the cloud beside the sad mascot.
 *
 * Absolutely positioned in the hero rather than dropped into a layout slot: it
 * belongs to the mascot, sitting below and to its right like a speech bubble.
 * It is outside `CloudScene` because that whole layer is `pointerEvents="none"`
 * and nothing inside it can be tapped.
 *
 * The tilt, the hard outline and the offset shadow with no blur are one idea: a
 * sticker sitting ON the scene rather than a control cut into it.
 */
const RestoreStreakButton = memo(function RestoreStreakButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style: object;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Restore your streak"
      hitSlop={10}
      style={[styles.restore, style]}
      transformStyle={[{ rotate: "-5deg" }]}
    >
      <Icon name="rotate-ccw" size={18} color={styles.restoreLabel.color} />
      <Text style={styles.restoreLabel}>Restore streak</Text>
    </PressableScale>
  );
});

/**
 * The cloud puffs, the mascot between them, and the parallax.
 *
 * Two clouds at different speeds and amplitudes is the whole effect: the back
 * one barely moves, the front one moves about three times as far, and the
 * mascot sits still between them, which is what makes the depth read. Drift is
 * horizontal only — a cloud that bobs vertically exposes the hero under its
 * bottom edge.
 */
/**
 * A steady left-right drift, -amplitude to +amplitude and back.
 *
 * Deliberately not `useFloatingValue` (which the notes above use): that hook
 * picks a random target every cycle, so a cloud regularly draws a target near
 * where it already is and sits still for several seconds. For two layers whose
 * whole job is to move at visibly different rates, unpredictable amplitude is
 * the one thing that kills the effect. A plain reversing timing keeps both
 * layers at a constant, readable speed.
 */
function useDrift(amplitude: number, period: number) {
  const value = useSharedValue(-amplitude);
  useEffect(() => {
    value.value = -amplitude;
    value.value = withRepeat(
      withTiming(amplitude, {
        duration: period,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(value);
  }, [amplitude, period, value]);
  return value;
}

const CloudScene = memo(function CloudScene({
  width,
  mood,
}: {
  width: number;
  mood: MascotMood;
}) {
  const sceneHeight = heroHeight(width) * SCENE_RATIO;

  // Speeds and travel live in `cloudDrift` (theme.ts) — see the note there on
  // why the ratio between these two matters more than either number.
  const backDrift = useDrift(
    width * cloudDrift.backAmplitude,
    cloudDrift.backPeriod,
  );
  const frontDrift = useDrift(
    width * cloudDrift.frontAmplitude,
    cloudDrift.frontPeriod,
  );

  const back = useAnimatedStyle(() => ({
    transform: [{ translateX: backDrift.value }],
  }));
  const front = useAnimatedStyle(() => ({
    transform: [{ translateX: frontDrift.value }],
  }));

  const overhang = width * 0.1;
  const cloudWidth = width + overhang * 2;
  /** Head width. The design keeps it around a third of the hero — big enough
   *  to be the subject, small enough that the clouds still frame it. */
  const mascotSize = width * 0.35;
  const limbSpan = mascotSize * 1.42;
  // Sad: nudged off centre so the restore button has the right half of the
  // cloud to sit on. `styles.mascot` centres it, so this is the offset from
  // centre rather than an absolute left.
  const mascotShift = mood === "sad" ? -width * 0.2 : 0;

  return (
    <View
      pointerEvents="none"
      style={[styles.scene, { height: sceneHeight }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          styles.cloudLayer,
          { left: -overhang, bottom: sceneHeight * 0.22 },
          back,
        ]}
      >
        <Svg
          width={cloudWidth}
          height={sceneHeight * 0.6}
          viewBox="0 0 400 180"
          preserveAspectRatio="none"
        >
          <Path d={CLOUD_BACK} fill={homeColors.cloudBack} />
        </Svg>
      </Animated.View>

      <View
        style={[
          styles.mascot,
          {
            bottom: sceneHeight * 0.16,
            width: mascotSize,
            height: mascotSize * 1.2,
            transform: [{ translateX: mascotShift }],
          },
        ]}
      >
        <MascotBody size={mascotSize} mood={mood} />
      </View>

      <Animated.View
        style={[styles.cloudLayer, { left: -overhang, bottom: 0 }, front]}
      >
        <Svg
          width={cloudWidth}
          height={sceneHeight * 0.72}
          viewBox="0 0 400 180"
          preserveAspectRatio="none"
        >
          <Path d={CLOUD_FRONT} fill={homeColors.cloudFront} />
        </Svg>
      </Animated.View>

      {/* Over the front cloud, but outside its drifting layer: the limbs belong
          to the mascot, and riding the cloud's ±22pt would visibly detach them
          from the body they hang off. */}
      <View
        style={[
          styles.mascot,
          {
            bottom: sceneHeight * 0.3,
            width: limbSpan,
            height: limbSpan * 0.2,
            transform: [{ translateX: mascotShift }],
          },
        ]}
      >
        <MascotLimbs width={limbSpan} />
      </View>
    </View>
  );
});

export interface HomeHeroProps {
  width: number;
  /** Status-bar inset; the hero runs underneath it. */
  topInset: number;
  greeting: string;
  name: string;
  streakCount: number;
  status: StreakStatus;
  /** [COMMENT LATER] Shown only when the streak is broken. */
  onRestorePress: () => void;
}

export const HomeHero = memo(function HomeHero({
  width,
  topInset,
  greeting,
  name,
  streakCount,
  status,
  onRestorePress,
}: HomeHeroProps) {
  const body = heroHeight(width);
  const broken = status === "broken";

  return (
    <Animated.View
      style={[
        styles.hero,
        { height: body + topInset, paddingTop: topInset + 12 },
      ]}
    >
      <View style={styles.greetBlock}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
          {name}
        </Text>
      </View>

      {/* Absolute, not a flex sibling of the greeting: the streak is sized from
          `streakDisplay` and is meant to be turned up until it is loud. In a row
          every point it grows is a point the greeting loses, and "Okay
          superstar," starts shrinking to fit. Out of flow, the two are
          independent and the knobs stay safe to turn. */}
      <View
        style={[styles.streak, { top: topInset + 40 }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          status === "broken"
            ? "No streak yet"
            : `${streakCount} day streak${status === "atRisk" ? ", at risk today" : ""}`
        }
      >
        <View style={styles.streakRow}>
          <StreakIcon status={status} size={streakDisplay.iconSize} />
          <Text
            style={[
              styles.streakCount,
              {
                fontSize:
                  streakCount > 999
                    ? streakDisplay.countSize - 30
                    : streakCount > 99
                      ? streakDisplay.countSize - 20
                      : streakDisplay.countSize,
              },
            ]}
          >
            {streakCount}
          </Text>
        </View>
        <Text style={styles.streakLabel}>
          {status === "atRisk"
            ? "SAVE IT TODAY"
            : status === "broken"
              ? "START A STREAK"
              : "DAY STREAK"}
        </Text>
      </View>
      <CloudScene width={width} mood={broken ? "sad" : "neutral"} />

      {/* After the clouds so the handwriting stays on top of them: the back
          cloud sits high enough now that it would otherwise clip the right
          note's arrow. */}
      <HandwrittenNote
        fontSize={17}
        lines={["Ready", "to speak?"]}
        arrowSize={66}
        color={homeColors.note}
        style={{ left: 24, top: topInset + body * 0.29 }}
      />
      <HandwrittenNote
        fontSize={12}
        lines={["Same you.", "Brighter you."]}
        arrowSize={66}
        color={homeColors.note}
        flip
        style={{
          right: 20,
          top: topInset + body * 0.5,
          transform: [{ rotate: "10deg" }],
        }}
      />

      {/* Last, so it sits over the clouds it rests on. */}
      {broken ? (
        <RestoreStreakButton
          onPress={onRestorePress}
          // Below and right of the mascot: it is shifted 14% of the width left
          // of centre and is 35% wide, so its right edge lands near 0.53w —
          // 0.56w clears it without crowding the screen edge.
          style={{ left: width * 0.5, bottom: body * 0.1 }}
        />
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  hero: {
    backgroundColor: homeColors.hero,
    borderBottomLeftRadius: homeRadius.hero,
    borderBottomRightRadius: homeRadius.hero,
    overflow: "hidden",
  },
  greetBlock: { paddingHorizontal: 22 },
  greeting: {
    fontFamily: homeFonts.regular,
    fontSize: 22,
    lineHeight: 28,
    color: homeColors.ink,
  },
  name: {
    fontFamily: homeFonts.bold,
    fontSize: 40,
    lineHeight: 50,
    letterSpacing: -1,
    color: homeColors.ink,
  },
  streak: { position: "absolute", right: 18, alignItems: "flex-end" },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  streakCount: {
    fontFamily: homeFonts.bold,
    fontSize: streakDisplay.countSize,
    lineHeight: streakDisplay.countSize * 1.12,
    letterSpacing: streakDisplay.countTracking,
    color: homeColors.ink,
    fontVariant: ["tabular-nums"],
  },
  streakLabel: {
    fontFamily: homeFonts.bold,
    fontSize: streakDisplay.labelSize,
    letterSpacing: 0.8,
    color: homeColors.heroText,
    marginTop: -6,
  },

  restore: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: homeColors.restorePill,
    borderRadius: homeRadius.pill,
    borderWidth: 2.5,
    borderColor: homeColors.ink,
    paddingVertical: 9,
    paddingHorizontal: 15,
    transform: [{ rotate: "-5deg" }],
    // A hard offset with no blur — a drawn shadow, not a lit one.
    shadowColor: homeColors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0,
  },
  restoreLabel: {
    fontFamily: homeFonts.bold,
    fontSize: 18,
    color: homeColors.cream,
  },

  scene: { position: "absolute", left: 0, right: 0, bottom: 0 },
  cloudLayer: { position: "absolute" },
  mascot: { position: "absolute", alignSelf: "center" },
});
