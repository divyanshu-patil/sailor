import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { PROFILE } from "@/screens/profile/theme";
import { usePreferenceStore } from "@/store/preference-store";
import DialTimePicker from "../components/dial-time-picker";
import { Ticks } from "../components/doodles";
import StepTitle from "../components/step-title";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

/** Header, title and the two-button footer — what the dials share the
 *  screen with. The dials take the rest, so the step never has to scroll. */
const RESERVED = 400;

/**
 * Step 11 — when the daily reminder fires. The last step before the profile.
 *
 * The chosen time is kept as a draft (`reminderTime`), so the frame's
 * "Set reminder" commits whatever the dials show — including the default,
 * untouched, which is the most common answer.
 */
export default function ReminderTimeStep({
  controller,
}: {
  controller: OnboardingController;
}) {
  const { width, height } = useWindowDimensions();
  const fallback = usePreferenceStore(
    (s) => s.preferences.practiceReminderTime,
  );
  const draft = controller.state?.data.reminderTime;
  const time = typeof draft === "string" ? draft : fallback || "18:00";

  // The picker is 2.24 radii tall (rings plus the capsule above them).
  const R = Math.round(
    Math.max(140, Math.min(width * 0.56, (height - RESERVED) / 2.24, 260)),
  );

  return (
    <View style={styles.body}>
      <View style={styles.titleWrap}>
        <Animated.View
          entering={FadeIn.delay(300).duration(400)}
          style={styles.titleTicks}
        >
          <Ticks color={PROFILE.accentYellow} rotate="-12deg" />
        </Animated.View>
        <StepTitle
          title="Set your nudge time"
          underline={{ width: 190, x: 62 }}
          subtitle="Turn the dials to pick a time."
          delay={60}
        />
      </View>

      <Animated.View
        entering={FadeInDown.delay(140).springify().damping(70)}
        style={styles.dials}
      >
        <DialTimePicker
          value={time}
          onChange={(next) => controller.setDraft({ reminderTime: next })}
          width={width}
          R={R}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  titleWrap: {
    marginTop: 20,
  },
  titleTicks: {
    position: "absolute",
    right: 0,
    top: -12,
  },
  dials: {
    marginTop: 18,
    // Full bleed: the rings run off both edges of the screen.
    marginHorizontal: -28,
    alignItems: "center",
  },
});
