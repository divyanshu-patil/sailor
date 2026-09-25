import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { CurlArrow, Ticks } from "../components/doodles";
import StepTitle from "../components/step-title";
import { StreakWeekPreview } from "../components/widget-previews";

/**
 * Step 10 — introduces the streak before the reminder time is picked, so the
 * time reads as "when do I keep my streak", not as a settings form.
 */
export default function BuildStreakStep() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 56, 360);

  return (
    <View style={styles.body}>
      <Animated.View
        entering={FadeIn.delay(380).duration(480)}
        style={styles.noteRow}
      >
        <Text style={styles.note}>{"Consistency\nbuilds confidence!"}</Text>
        <View style={styles.noteArrow}>
          <CurlArrow width={44} rotate="-30deg" />
        </View>
      </Animated.View>

      <View style={styles.hero}>
        <Animated.View
          entering={FadeIn.delay(300).duration(400)}
          style={styles.heroTicks}
        >
          <Ticks color="#F28DB2" rotate="-110deg" />
        </Animated.View>
        <Animated.View
          entering={FadeInDown.springify().damping(70)}
          style={{ transform: [{ rotate: "-3deg" }] }}
        >
          <StreakWeekPreview width={cardWidth} />
        </Animated.View>
      </View>

      <View style={styles.title}>
        <StepTitle
          title="Build your streak"
          underline={{ width: 170, x: 58 }}
          subtitle="A little every day adds up fast."
          delay={180}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    // With the widget and the title the whole screen, the pair sits in the
    // middle of it, a touch high, rather than hanging from the top.
    justifyContent: "center",
    paddingBottom: 48,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 14,
    marginLeft: 6,
  },
  note: {
    fontFamily: profileFonts.handwritten,
    fontSize: 15.5,
    lineHeight: 19,
    color: PROFILE.muted,
    transform: [{ rotate: "-6deg" }],
  },
  noteArrow: {
    marginLeft: 12,
    marginBottom: -10,
  },
  hero: {
    alignItems: "center",
    marginTop: 18,
  },
  heroTicks: {
    position: "absolute",
    left: -6,
    top: -2,
  },
  title: {
    marginTop: 40,
  },
});
