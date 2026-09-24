import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { CurlArrow, Ticks } from "../components/doodles";
import StepTitle from "../components/step-title";
import {
  PracticePreview,
  ReminderPreview,
  StreakPreview,
} from "../components/widget-previews";

/**
 * Step 9 — offers the home-screen widgets. iOS gives an app no way to add a
 * widget for the user, so "Add widget" in the frame explains the three taps;
 * this step only has to make the widgets worth those taps.
 */
export default function HomeWidgetStep() {
  const { width } = useWindowDimensions();
  const column = width - 56;
  const gap = 14;
  const small = (column - gap) / 2;
  const medium = column * 0.84;

  return (
    <View style={styles.body}>
      <Animated.View
        entering={FadeIn.delay(380).duration(480)}
        style={styles.noteRow}
      >
        <Text style={styles.note}>
          {"Quick access\nto your practice\nright from\nyour home screen!"}
        </Text>
        <View style={styles.noteArrow}>
          <CurlArrow width={46} rotate="-30deg" />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(560).springify().damping(18)}
        style={styles.medium}
      >
        <PracticePreview width={medium} />
      </Animated.View>

      <View style={[styles.smallRow, { gap }]}>
        <Animated.View
          entering={FadeInDown.delay(90).duration(560).springify().damping(18)}
          style={{ transform: [{ rotate: "-1.5deg" }] }}
        >
          <ReminderPreview width={small} />
        </Animated.View>
        <Animated.View
          entering={FadeInDown.delay(160).duration(560).springify().damping(18)}
          style={{ transform: [{ rotate: "1.5deg" }] }}
        >
          <StreakPreview width={small} />
        </Animated.View>
      </View>

      <View style={styles.title}>
        <Animated.View
          entering={FadeIn.delay(420).duration(400)}
          style={styles.titleTicks}
        >
          <Ticks color={PROFILE.accentYellow} rotate="-100deg" />
        </Animated.View>
        <StepTitle
          title={"Add Sailors to\nyour home screen"}
          underline={{ width: 250, x: 10 }}
          subtitle="Track your progress, get practice reminders and jump into a session — all from your home screen."
          delay={200}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
    marginLeft: 8,
  },
  note: {
    fontFamily: profileFonts.handwritten,
    fontSize: 15.5,
    lineHeight: 19,
    color: PROFILE.muted,
    transform: [{ rotate: "-6deg" }],
  },
  noteArrow: {
    marginLeft: 14,
    marginBottom: -8,
  },
  medium: {
    alignSelf: "center",
    marginTop: 8,
  },
  smallRow: {
    flexDirection: "row",
    marginTop: 14,
  },
  title: {
    marginTop: 24,
  },
  titleTicks: {
    position: "absolute",
    left: 8,
    top: -6,
  },
});
