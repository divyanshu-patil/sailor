import { type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { PROFILE, PROFILE_PASTELS, profileFonts } from "@/screens/profile/theme";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

interface ContextOption {
  /** Persisted value. */
  value: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  card: string;
}

const OPTIONS: ContextOption[] = [
  {
    value: "college",
    label: "College / Classroom",
    icon: "school",
    card: PROFILE_PASTELS.purple,
  },
  {
    value: "work",
    label: "Work / Meetings",
    icon: "briefcase",
    card: PROFILE_PASTELS.blue,
  },
  {
    value: "presentations",
    label: "Presentations",
    icon: "mic",
    card: PROFILE_PASTELS.yellow,
  },
  {
    value: "everyday",
    label: "Everyday Conversations",
    icon: "people",
    card: PROFILE_PASTELS.mint,
  },
  {
    value: "interviews",
    label: "Interviews",
    icon: "laptop",
    card: PROFILE_PASTELS.pink,
  },
  {
    value: "english",
    label: "Speaking English with Others",
    icon: "globe",
    card: PROFILE_PASTELS.purple,
  },
];

/**
 * Step 5 — the places the user speaks most often. Multi-select: tapping a card
 * toggles it, and the whole set is committed when the step advances.
 */
export default function SpeakingContextsStep({
  controller,
}: {
  controller: OnboardingController;
}) {
  const selected = Array.isArray(controller.state?.data.speakingContexts)
    ? (controller.state.data.speakingContexts as string[])
    : [];

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    controller.setDraft({ speakingContexts: next });
  };

  return (
    <View style={styles.body}>
      <Text style={styles.heading}>{"Where do you speak\nmost often?"}</Text>
      <Text style={styles.subtitle}>Pick all that apply.</Text>

      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const active = selected.includes(option.value);
          return (
            <PressableScale
              key={option.value}
              onPress={() => toggle(option.value)}
              style={[
                styles.card,
                { backgroundColor: option.card },
                active && styles.cardActive,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={option.label}
            >
              <View style={styles.badge}>
                <Ionicons name={option.icon} size={22} color={PROFILE.ink} />
              </View>
              <Text style={styles.label}>{option.label}</Text>
              <View style={[styles.checkbox, active && styles.checkboxActive]}>
                {active ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={PROFILE.white}
                  />
                ) : null}
              </View>
            </PressableScale>
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
    minHeight: 76,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardActive: {
    borderColor: PROFILE.ink,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PROFILE.white,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    marginLeft: 14,
    fontFamily: profileFonts.display,
    fontSize: 17,
    letterSpacing: -0.3,
    color: PROFILE.ink,
  },
  checkbox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#bebcbc",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: PROFILE.ink,
    borderColor: PROFILE.ink,
  },
});
