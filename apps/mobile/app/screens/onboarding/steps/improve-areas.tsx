import { type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { haptics } from "@/lib/haptics";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { pillMark, SelectionMark, Stagger } from "../components/choice-motion";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

/** The pills' height; the check mark sits by it (see `pillMark`). */
const CARD_HEIGHT = 85;

interface ImproveOption {
  /** Persisted value. */
  value: string;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  /** Card tint, and the icon badge a shade darker than it. */
  card: string;
  badge: string;
}

const OPTIONS: ImproveOption[] = [
  {
    value: "confidence",
    title: "Speak More Confidently",
    subtitle: "Feel comfortable expressing myself.",
    icon: "megaphone",
    card: "#E7F5EC",
    badge: "#B7E3C8",
  },
  {
    value: "fluency",
    title: "Speak More Fluently",
    subtitle: "Stop getting stuck or pausing too much.",
    icon: "chatbubble-ellipses",
    card: "#FBE4EC",
    badge: "#F5BACE",
  },
  {
    value: "words",
    title: "Find the Right Words",
    subtitle: "Express my thoughts more easily.",
    icon: "sparkles",
    card: "#FDF3D9",
    badge: "#F5DA92",
  },
  {
    value: "clarity",
    title: "Speak More Clearly",
    subtitle: "Make my words easier to understand.",
    icon: "locate",
    card: "#E6F0FC",
    badge: "#BBD4F4",
  },
  {
    value: "vocabulary",
    title: "Build My Vocabulary",
    subtitle: "Use better and more natural words.",
    icon: "book",
    card: "#F0E9FB",
    badge: "#D3BDF0",
  },
  {
    value: "presenting",
    title: "Present Better",
    subtitle: "Feel confident speaking in front of people.",
    icon: "mic",
    card: "#FDEFE3",
    badge: "#F6C9A6",
  },
  {
    value: "interviews",
    title: "Ace Interviews",
    subtitle: "Give stronger, clearer answers.",
    icon: "briefcase",
    card: "#E7F5EC",
    badge: "#B7E3C8",
  },
  {
    value: "conversations",
    title: "Handle Conversations",
    subtitle: "Keep conversations natural and engaging.",
    icon: "people",
    card: "#FBE4EC",
    badge: "#F5BACE",
  },
];

/**
 * Step 6 — the skills the user wants to improve. Multi-select: tapping a card
 * toggles it, and the whole set is committed when the step advances.
 */
export default function ImproveAreasStep({
  controller,
}: {
  controller: OnboardingController;
}) {
  const selected = Array.isArray(controller.state?.data.improvementAreas)
    ? (controller.state.data.improvementAreas as string[])
    : [];

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    controller.setDraft({ improvementAreas: next });
  };

  return (
    <View style={styles.body}>
      <Text style={styles.heading}>{"What do you want\nto improve?"}</Text>
      <Text style={styles.subtitle}>
        Pick what you’d like to get better at.
      </Text>

      <View style={styles.options}>
        {OPTIONS.map((option, i) => {
          const active = selected.includes(option.value);
          return (
            <Stagger key={option.value} index={i}>
              <PressableScale
                haptic={haptics.select}
                onPress={() => toggle(option.value)}
                style={[
                  styles.card,
                  { backgroundColor: option.card },
                  active && { borderColor: option.badge },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${option.title}. ${option.subtitle}`}
              >
                <View style={[styles.badge, { backgroundColor: option.badge }]}>
                  <Ionicons name={option.icon} size={24} color={PROFILE.ink} />
                </View>
                <View style={styles.text}>
                  <Text style={styles.title}>{option.title}</Text>
                  <Text style={styles.description}>{option.subtitle}</Text>
                </View>
                <SelectionMark active={active} style={pillMark(CARD_HEIGHT)} />
              </PressableScale>
            </Stagger>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  heading: {
    marginTop: 16,
    fontFamily: profileFonts.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
    color: PROFILE.ink,
  },
  subtitle: {
    marginTop: 12,
    fontFamily: profileFonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: PROFILE.muted,
  },
  options: {
    marginTop: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: CARD_HEIGHT,
    marginBottom: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "transparent",
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  title: {
    fontFamily: profileFonts.display,
    fontSize: 17,
    letterSpacing: -0.3,
    color: PROFILE.ink,
  },
  description: {
    marginTop: 3,
    fontFamily: profileFonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: PROFILE.muted,
  },
});
