import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { haptics } from "@/lib/haptics";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import type { DemoOption } from "@/services/onboarding-demo.service";
import { MOOD_OPTIONS } from "@/types/settings/preferences";
import { SelectionMark, Stagger } from "../components/choice-motion";

/**
 * One tint per brief, in order — never per context, which gave two briefs from
 * the same context the same card. Deeper than the page's cream so each card
 * stands off it (the peach it replaced nearly vanished into it); `accent` is
 * the selected border.
 */
const BRIEF_TINTS = [
  { card: "#FAD9E4", badge: "#F2AFC6", accent: "#E0668F" },
  { card: "#D9E6FA", badge: "#AEC8F0", accent: "#5B86D6" },
  { card: "#D6EEDF", badge: "#A5DAB9", accent: "#3FA06E" },
  { card: "#E6DCF8", badge: "#C6B0EE", accent: "#8A63D2" },
  { card: "#F9ECC2", badge: "#EDD083", accent: "#C99A1E" },
];

const CONTEXT_ICON: Record<
  string,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  college: "school",
  work: "briefcase",
  presentations: "easel",
  everyday: "cafe",
  interviews: "people",
  english: "chatbubbles",
};

export const moodLabel = (mood: string) =>
  MOOD_OPTIONS.find((m) => m.tag === mood)?.label ?? mood;

function Skeleton({ index }: { index: number }) {
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Stagger index={index}>
      <Animated.View style={[styles.card, styles.skeleton, style]} />
    </Stagger>
  );
}

/**
 * Step one of the demo, standing in for the wizard's "describe your talk":
 * instead of typing a brief, the user picks one of a few written for the
 * situations they told us they speak in.
 */
export default function DemoPicker({
  options,
  selectedId,
  onSelect,
  error,
  onRetry,
}: {
  options: DemoOption[] | null;
  selectedId: string | null;
  onSelect: (option: DemoOption) => void;
  error: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <View style={styles.error}>
        <Ionicons
          name="cloud-offline-outline"
          size={34}
          color={PROFILE.muted}
        />
        <Text style={styles.errorText}>
          Couldn&apos;t load the demo. Check your connection.
        </Text>
        <PressableScale
          onPress={onRetry}
          style={styles.retry}
          accessibilityRole="button"
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </PressableScale>
      </View>
    );
  }

  if (!options) {
    return (
      <View style={styles.list}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} index={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {options.map((option, i) => {
        const active = option.id === selectedId;
        const tint = BRIEF_TINTS[i % BRIEF_TINTS.length];
        return (
          <Stagger key={option.id} index={i}>
            <PressableScale
              haptic={haptics.select}
              onPress={() => onSelect(option)}
              style={[
                styles.card,
                { backgroundColor: tint.card },
                active && { borderColor: tint.accent },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label}. ${option.brief}`}
            >
              <View style={styles.row}>
                <View style={[styles.badge, { backgroundColor: tint.badge }]}>
                  <Ionicons
                    name={CONTEXT_ICON[option.context] ?? "sparkles"}
                    size={20}
                    color={PROFILE.ink}
                  />
                </View>
                <Text style={styles.label} numberOfLines={1}>
                  {option.label}
                </Text>
              </View>
              <Text style={styles.brief} numberOfLines={3}>
                {option.brief}
              </Text>
              <View style={styles.meta}>
                <Meta
                  icon="time-outline"
                  text={`${option.durationMinutes} min`}
                />
                <Meta
                  icon="albums-outline"
                  text={`${option.cardCount} cards`}
                />
                <Meta icon="happy-outline" text={moodLabel(option.mood)} />
              </View>
              <SelectionMark active={active} />
            </PressableScale>
          </Stagger>
        );
      })}
    </View>
  );
}

function Meta({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={13} color={PROFILE.ink} />
      <Text style={styles.chipLabel}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
  },
  skeleton: {
    height: 132,
    backgroundColor: "#F1E9DE",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 28,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontFamily: profileFonts.display,
    fontSize: 17,
    letterSpacing: -0.3,
    color: PROFILE.ink,
  },
  brief: {
    marginTop: 10,
    fontFamily: profileFonts.body,
    fontSize: 14.5,
    lineHeight: 20,
    color: "#5E5850",
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  chipLabel: {
    fontFamily: profileFonts.medium,
    fontSize: 12.5,
    color: PROFILE.ink,
  },
  error: {
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
  },
  errorText: {
    fontFamily: profileFonts.body,
    fontSize: 16,
    color: PROFILE.muted,
    textAlign: "center",
  },
  retry: {
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 999,
    backgroundColor: PROFILE.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  retryLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 15,
    color: PROFILE.white,
  },
});
