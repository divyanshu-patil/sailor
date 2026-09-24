import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { PROFILE, profileFonts } from "@/screens/profile/theme";

interface StepTitleProps {
  title: string;
  /** Width and horizontal nudge of the marker stroke under the title, so it
   *  sits under the words that matter rather than the whole line. */
  underline: { width: number; x?: number };
  subtitle: string;
  /** Entrance delay, so the title lands after the step's hero. */
  delay?: number;
}

/**
 * The heading, marker underline and subtitle the illustrated steps share.
 *
 * The entrance is a short rise; the underline is part of the same block so it
 * never arrives before the words it underlines.
 */
const StepTitle = memo(function StepTitle({
  title,
  underline,
  subtitle,
  delay = 120,
}: StepTitleProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(480)}>
      <Text style={styles.heading}>{title}</Text>
      <View
        style={[
          styles.underline,
          {
            width: underline.width,
            transform: [
              { rotate: "-1.2deg" },
              { translateX: underline.x ?? 0 },
            ],
          },
        ]}
      />
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Animated.View>
  );
});

export default StepTitle;

const styles = StyleSheet.create({
  heading: {
    fontFamily: profileFonts.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
    textAlign: "center",
    color: PROFILE.ink,
  },
  underline: {
    alignSelf: "center",
    marginTop: 2,
    height: 7,
    borderRadius: 4,
    backgroundColor: PROFILE.accentYellow,
  },
  subtitle: {
    marginTop: 14,
    paddingHorizontal: 8,
    fontFamily: profileFonts.body,
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    color: PROFILE.muted,
  },
});
