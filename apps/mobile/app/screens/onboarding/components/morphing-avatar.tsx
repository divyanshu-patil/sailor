import { memo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import ProfileAvatar from "@/components/ui/profile-avatar";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { PROFILE, PROFILE_PASTELS } from "@/screens/profile/theme";

/** The nickname pauses this long before the face morphs, so typing "sam"
 *  produces one hand-off rather than three. */
const NAME_DEBOUNCE_MS = 260;
const MORPH_IN_MS = 420;
const MORPH_OUT_MS = 320;

// The blur is the part that reads as a morph rather than a swap: the new face
// resolves out of a haze while the old one dissolves into it. Android has no
// animated filter, so it gets the scale/rotate hand-off only.
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
        duration: MORPH_IN_MS,
        easing: Easing.out(Easing.cubic),
      }),
      transform: [
        { scale: withSpring(1, { damping: 11, stiffness: 150, mass: 0.7 }) },
        {
          rotate: withTiming("0deg", {
            duration: MORPH_IN_MS,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
      ...(BLUR
        ? { filter: [{ blur: withTiming(0, { duration: MORPH_IN_MS }) }] }
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
        duration: MORPH_OUT_MS,
        easing: Easing.in(Easing.cubic),
      }),
      transform: [
        { scale: withTiming(1.18, { duration: MORPH_OUT_MS }) },
        { rotate: withTiming("10deg", { duration: MORPH_OUT_MS }) },
      ],
      ...(BLUR
        ? { filter: [{ blur: withTiming(6, { duration: MORPH_OUT_MS }) }] }
        : {}),
    },
  };
};

interface MorphingAvatarProps {
  name: string;
  size: number;
  backgroundColor?: string;
}

/**
 * The onboarding avatar, animated across changes.
 *
 * The pink circle is a fixed layer; only the character inside it morphs. Each
 * face is keyed by its seed, so when the nickname settles the old Blobatar
 * scales/tilts/blurs out while the new one springs in, clipped to the circle —
 * a physical hand-off rather than the hard swap `ProfileAvatar` would do.
 */
const MorphingAvatar = memo(function MorphingAvatar({
  name,
  size,
  backgroundColor = PROFILE_PASTELS.pink,
}: MorphingAvatarProps) {
  const seed = useDebouncedValue(name.trim(), NAME_DEBOUNCE_MS);

  return (
    <View
      style={[
        styles.clip,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      <Animated.View
        key={seed || "empty"}
        entering={morphIn}
        exiting={morphOut}
        style={StyleSheet.absoluteFill}
      >
        {seed ? (
          <ProfileAvatar
            name={seed}
            size={size}
            backgroundColor="transparent"
            accessibilityLabel={`${seed}'s avatar`}
          />
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
