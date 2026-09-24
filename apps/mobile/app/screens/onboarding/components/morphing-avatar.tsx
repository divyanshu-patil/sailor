import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from "react-native-reanimated";
import { Circle, Path, Svg } from "react-native-svg";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useDebouncedValue } from "@/hooks/use-debounce";
import { PROFILE, PROFILE_PASTELS } from "@/screens/profile/theme";
import {
  figureFor,
  lerpFigure,
  pathFromPoints,
} from "@/lib/blob-shape-morph";

/** The nickname pauses this long before the face morphs, so typing "sam"
 *  produces one hand-off rather than three. */
const NAME_DEBOUNCE_MS = 260;
/** How long the sampled geometry takes to travel from one face to the next. */
const MORPH_MS = 380;

// The blur is the part that reads as a morph rather than a swap: the new face
// resolves out of a haze while the old one dissolves into it. Android has no
// animated filter, so it gets the scale/rotate hand-off only. Used only at the
// placeholder boundary — name-to-name travels by shape, not by this.
const BLUR = Platform.OS === "ios";

/** The new face springs up from small and tilted; the old one lifts away. */
const morphIn: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: {
      opacity: 0,
      transform: [{ scale: 0.55 }, { rotate: "-14deg" }],
      ...(BLUR ? { filter: [{ blur: 8 }] } : {}),
    },
    animations: {
      opacity: withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
      transform: [
        { scale: withSpring(1, { damping: 11, stiffness: 150, mass: 0.7 }) },
        {
          rotate: withTiming("0deg", {
            duration: 420,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
      ...(BLUR
        ? { filter: [{ blur: withTiming(0, { duration: 420 }) }] }
        : {}),
    },
  };
};

const morphOut: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: {
      opacity: 1,
      transform: [{ scale: 1 }, { rotate: "0deg" }],
      ...(BLUR ? { filter: [{ blur: 0 }] } : {}),
    },
    animations: {
      opacity: withTiming(0, {
        duration: 320,
        easing: Easing.in(Easing.cubic),
      }),
      transform: [
        { scale: withTiming(1.18, { duration: 320 }) },
        { rotate: withTiming("10deg", { duration: 320 }) },
      ],
      ...(BLUR ? { filter: [{ blur: withTiming(6, { duration: 320 }) }] } : {}),
    },
  };
};

const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * One generated face, morphing its *geometry* into the next.
 *
 * Where the old hand-off scaled and blurred two faces past each other, this
 * samples each name's drawn paths to a shared point count and lerps them, so
 * the silhouette itself travels — a sun's lobes retract into a round head, a
 * triangle settles into a pebble, colours cross-fade alongside.
 */
function BlobMorph({ seed, size }: { seed: string; size: number }) {
  const target = useMemo(() => figureFor(seed), [seed]);
  const [shown, setShown] = useState(target);
  const shownRef = useRef(shown);
  const rafRef = useRef(0);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  // Runs on a name change; the mount pass finds `from` already equal to the
  // target, so a face never animates in — only into the next one.
  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const u = Math.min(1, (now - start) / MORPH_MS);
      const frame = lerpFigure(from, target, ease(u));
      shownRef.current = frame;
      setShown(frame);
      if (u < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, seed]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${seed}'s avatar`}
    >
      {shown.petals.map((c, i) => (
        <Circle key={`p${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={shown.head} />
      ))}
      {shown.extras.map((pts, i) => (
        <Path key={`x${i}`} d={pathFromPoints(pts)} fill={shown.head} />
      ))}
      <Path d={pathFromPoints(shown.body)} fill={shown.head} />
      {shown.eyes.map((pts, i) => (
        <Path key={`e${i}`} d={pathFromPoints(pts)} fill={shown.eye} />
      ))}
    </Svg>
  );
}

interface MorphingAvatarProps {
  name: string;
  size: number;
  backgroundColor?: string;
}

/**
 * The onboarding avatar.
 *
 * The pink circle is a fixed layer. The character inside it changes as the
 * nickname settles: on the first face the placeholder hands off with a
 * scale/tilt/blur, and every face after that morphs its shape into the next
 * (`BlobMorph`). The debounce is what makes a typed nickname one hand-off
 * rather than one per keystroke.
 */
const MorphingAvatar = memo(function MorphingAvatar({
  name,
  size,
}: MorphingAvatarProps) {
  const seed = useDebouncedValue(name.trim(), NAME_DEBOUNCE_MS);

  return (
    <View
      style={[
        styles.clip,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Animated.View
        key={seed ? "blob" : "empty"}
        entering={morphIn}
        exiting={morphOut}
        style={StyleSheet.absoluteFill}
      >
        {seed ? (
          <BlobMorph seed={seed} size={size} />
        ) : (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="Default profile picture"
            style={styles.dummy}
          >
            <Ionicons name="person" size={size * 0.42} color={PROFILE.white} />
          </View>
        )}
      </Animated.View>
    </View>
  );
});

export default MorphingAvatar;

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  dummy: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
