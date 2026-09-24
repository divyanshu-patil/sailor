import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { haptics } from "@/lib/haptics";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { usePreferenceStore } from "@/store/preference-store";
import { Ticks } from "../components/doodles";
import StepTitle from "../components/step-title";
import {
  PeriodToggle,
  WHEEL_ITEM,
  Wheel,
  type WheelHandle,
} from "../components/time-wheel";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

const PRESETS = [
  { label: "Morning", icon: "sunny-outline", time: "08:00" },
  { label: "Lunch", icon: "cafe-outline", time: "12:30" },
  { label: "Evening", icon: "moon-outline", time: "18:00" },
] as const;

/** "18:05" → the wheel's rows and the period. Minutes round to the nearest 5. */
export function splitTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour24 = Number.isFinite(h) ? ((h % 24) + 24) % 24 : 18;
  const minute = Number.isFinite(m) ? Math.min(55, Math.round(m / 5) * 5) : 0;
  return {
    hourIndex: (hour24 + 11) % 12,
    minuteIndex: minute / 5,
    period: (hour24 < 12 ? "AM" : "PM") as "AM" | "PM",
  };
}

export function joinTime(
  hourIndex: number,
  minuteIndex: number,
  period: "AM" | "PM",
) {
  const hour12 = hourIndex + 1;
  const hour24 = (hour12 % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minuteIndex * 5).padStart(2, "0")}`;
}

/**
 * Step 11 — when the daily reminder fires. The last step before the profile.
 *
 * The chosen time is kept as a draft (`reminderTime`), so the frame's
 * "Set reminder" commits whatever the wheels show — including the default,
 * untouched, which is the most common answer.
 */
export default function ReminderTimeStep({
  controller,
}: {
  controller: OnboardingController;
}) {
  const fallback = usePreferenceStore(
    (s) => s.preferences.practiceReminderTime,
  );
  const draft = controller.state?.data.reminderTime;
  const time = typeof draft === "string" ? draft : fallback || "18:00";
  const { hourIndex, minuteIndex, period } = splitTime(time);

  // The wheels own their scroll position; these only steer them for presets.
  const hourWheel = useRef<WheelHandle>(null);
  const minuteWheel = useRef<WheelHandle>(null);
  // The first mount's position. Later changes come from the wheels
  // themselves, so feeding them back in would fight the scroll.
  const [initial] = useState({ hourIndex, minuteIndex });

  const set = (next: string) => controller.setDraft({ reminderTime: next });

  return (
    <View style={styles.body}>
      <View style={styles.titleWrap}>
        <Animated.View
          entering={FadeIn.delay(360).duration(400)}
          style={styles.titleTicks}
        >
          <Ticks color={PROFILE.accentYellow} rotate="-12deg" />
        </Animated.View>
        <StepTitle
          title={"When should we\nremind you?"}
          underline={{ width: 180, x: 34 }}
          subtitle="Pick a time that fits your day. We'll send one gentle nudge to keep your streak going."
          delay={60}
        />
      </View>

      <Animated.View
        entering={FadeInDown.delay(160).duration(560).springify().damping(18)}
        style={styles.card}
      >
        <View style={styles.band} pointerEvents="none" />
        <View style={styles.wheels}>
          <Wheel
            ref={hourWheel}
            values={HOURS}
            initialIndex={initial.hourIndex}
            width={78}
            onChange={(i) => set(joinTime(i, minuteIndex, period))}
          />
          <Text style={styles.colon}>:</Text>
          <Wheel
            ref={minuteWheel}
            values={MINUTES}
            initialIndex={initial.minuteIndex}
            width={78}
            onChange={(i) => set(joinTime(hourIndex, i, period))}
          />
          <View style={styles.divider} />
          <PeriodToggle
            value={period}
            onChange={(p) => set(joinTime(hourIndex, minuteIndex, p))}
          />
        </View>
        {/* Fades the wheels' top and bottom rows into the card. */}
        <View style={[styles.mask, styles.maskTop]} pointerEvents="none" />
        <View style={[styles.mask, styles.maskBottom]} pointerEvents="none" />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(260).duration(480)}
        style={styles.presets}
      >
        {PRESETS.map((preset) => {
          const active = preset.time === time;
          return (
            <PressableScale
              key={preset.label}
              onPress={() => {
                haptics.select();
                const next = splitTime(preset.time);
                hourWheel.current?.scrollToIndex(next.hourIndex);
                minuteWheel.current?.scrollToIndex(next.minuteIndex);
                set(preset.time);
              }}
              style={[styles.preset, active && styles.presetActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={preset.label}
            >
              <Ionicons
                name={preset.icon}
                size={16}
                color={active ? PROFILE.white : PROFILE.ink}
              />
              <Text
                style={[styles.presetLabel, active && styles.presetLabelActive]}
              >
                {preset.label}
              </Text>
            </PressableScale>
          );
        })}
      </Animated.View>

      <Animated.Text
        entering={FadeIn.delay(420).duration(400)}
        style={styles.note}
      >
        You can change this anytime in Settings.
      </Animated.Text>
    </View>
  );
}

const CARD_PAD = 14;

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  titleWrap: {
    marginTop: 26,
  },
  titleTicks: {
    position: "absolute",
    right: 6,
    top: -14,
  },
  card: {
    marginTop: 30,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: CARD_PAD,
    borderRadius: 30,
    backgroundColor: "#FFFDFA",
    shadowColor: "#8A6A45",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    overflow: "hidden",
  },
  band: {
    position: "absolute",
    left: 12,
    // Stops at the divider: the AM/PM toggle is its own control, not a row.
    right: 18 + 64 + 29 - 6,
    top: CARD_PAD + WHEEL_ITEM * 2,
    height: WHEEL_ITEM,
    borderRadius: 16,
    backgroundColor: "#F8EFE2",
  },
  wheels: {
    flexDirection: "row",
    alignItems: "center",
  },
  colon: {
    fontFamily: profileFonts.display,
    fontSize: 32,
    color: PROFILE.ink,
    marginTop: -4,
    marginHorizontal: 2,
  },
  divider: {
    width: 1,
    height: WHEEL_ITEM * 2,
    marginHorizontal: 14,
    backgroundColor: "#EFE6DA",
  },
  mask: {
    position: "absolute",
    left: 0,
    right: 0,
    height: CARD_PAD + 8,
    backgroundColor: "#FFFDFA",
    opacity: 0.6,
  },
  maskTop: { top: 0 },
  maskBottom: { bottom: 0 },
  presets: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },
  preset: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#F3EADF",
    borderWidth: 1,
    borderColor: "#EADFD1",
  },
  presetActive: {
    backgroundColor: PROFILE.ink,
    borderColor: PROFILE.ink,
  },
  presetLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 14,
    color: PROFILE.ink,
  },
  presetLabelActive: {
    color: PROFILE.white,
  },
  note: {
    marginTop: 18,
    textAlign: "center",
    fontFamily: profileFonts.handwritten,
    fontSize: 15,
    color: PROFILE.muted,
  },
});
