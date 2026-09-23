import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { stepRoute } from "../config/routes";
import GenderMascot, {
  type GenderMascotVariant,
} from "../components/gender-mascot";
import OnboardingScreen from "../components/onboarding-screen";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

interface GenderOption {
  /** Persisted value. */
  value: string;
  title: string;
  subtitle: string;
  background: string;
  blob: string;
  variant: GenderMascotVariant;
}

const OPTIONS: GenderOption[] = [
  {
    value: "male",
    title: "Male",
    subtitle: "He / Him",
    background: "#FBE3EA",
    blob: "#A9B8F0",
    variant: "male",
  },
  {
    value: "female",
    title: "Female",
    subtitle: "She / Her",
    background: "#FDF0DE",
    blob: "#F7B9CD",
    variant: "female",
  },
  {
    value: "unspecified",
    title: "Prefer not to say",
    subtitle: "Any pronouns",
    background: "#E4F1E6",
    blob: "#9FD9B8",
    variant: "neutral",
  },
];

/**
 * Step 2 — the gender.
 *
 * Three pastel cards, each with its own little blob. A choice is required to
 * continue; the answer is stored on the step and never claimed against the
 * account (there is nothing to claim, unlike the nickname).
 */
export default function GenderStep({
  controller,
  authenticated,
}: {
  controller: OnboardingController;
  authenticated: boolean;
}) {
  // Restored from the persisted draft, so a force-close mid-step resumes.
  const persisted =
    typeof controller.state?.data.gender === "string"
      ? controller.state.data.gender
      : null;
  const [selected, setSelected] = useState<string | null>(persisted);
  const [submitting, setSubmitting] = useState(false);

  const busy = submitting || controller.committing;
  const canContinue = selected !== null && !busy;

  const handleContinue = async () => {
    if (!canContinue || !selected) return;
    setSubmitting(true);
    try {
      const next = await controller.submitGender(selected);
      if (next === null) {
        // Flow finished — same hand-off as the nickname step's last step.
        if (authenticated) {
          router.replace("/(profile-setup)" as Href);
        } else {
          router.push({
            pathname: "/(unauthenticated)",
            params: { createAccount: "1", from: "onboarding" },
          } as Href);
        }
      } else {
        router.push(stepRoute(next));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingScreen
      progress={controller.progress}
      showBack={false}
      footer={
        <PressableScale
          onPress={handleContinue}
          disabled={!canContinue}
          style={[styles.continue, !canContinue && styles.continueDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
          accessibilityLabel="Continue"
        >
          {busy ? (
            <ActivityIndicator
              color={canContinue ? PROFILE.white : PROFILE.muted}
            />
          ) : (
            <Text
              style={[
                styles.continueLabel,
                !canContinue && styles.continueLabelDisabled,
              ]}
            >
              Continue
            </Text>
          )}
        </PressableScale>
      }
    >
      <View style={styles.body}>
        <Text style={styles.heading}>{"Choose your\nGender"}</Text>
        <View style={styles.underline} />
        <Text style={styles.subtitle}>
          This will be used to personalise your speaking journey.
        </Text>

        <View style={styles.note} pointerEvents="none">
          <Text style={styles.noteText}>{"Be you\nAlways!"}</Text>
          <Ionicons
            name="heart-outline"
            size={22}
            color={PROFILE.muted}
            style={styles.heart}
          />
        </View>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const active = selected === option.value;
            return (
              <PressableScale
                key={option.value}
                onPress={() => setSelected(option.value)}
                style={[
                  styles.card,
                  { backgroundColor: option.background },
                  active && styles.cardActive,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option.title}, ${option.subtitle}`}
              >
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{option.title}</Text>
                  <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
                </View>
                <View style={styles.mascot}>
                  <GenderMascot
                    color={option.blob}
                    variant={option.variant}
                    size={122}
                  />
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    position: "relative",
  },
  heading: {
    marginTop: 16,
    fontFamily: profileFonts.display,
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -1.2,
    color: PROFILE.ink,
  },
  underline: {
    marginTop: 2,
    width: 156,
    height: 9,
    borderRadius: 5,
    backgroundColor: PROFILE.accentYellow,
    transform: [{ rotate: "-1deg" }],
  },
  subtitle: {
    marginTop: 16,
    maxWidth: "78%",
    fontFamily: profileFonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: PROFILE.muted,
  },
  note: {
    position: "absolute",
    top: 6,
    right: 0,
    alignItems: "center",
  },
  noteText: {
    fontFamily: profileFonts.handwritten,
    fontSize: 18,
    lineHeight: 23,
    color: PROFILE.muted,
    textAlign: "center",
  },
  heart: { marginTop: 2 },
  options: {
    marginTop: 28,
  },
  card: {
    minHeight: 132,
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardActive: { borderColor: PROFILE.ink },
  cardText: { maxWidth: "64%" },
  cardTitle: {
    fontFamily: profileFonts.display,
    fontSize: 21,
    letterSpacing: -0.4,
    color: PROFILE.ink,
  },
  cardSubtitle: {
    marginTop: 4,
    fontFamily: profileFonts.body,
    fontSize: 16,
    color: PROFILE.muted,
  },
  mascot: {
    position: "absolute",
    right: -10,
    bottom: -6,
  },
  continue: {
    height: 58,
    borderRadius: 999,
    backgroundColor: PROFILE.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  continueDisabled: { backgroundColor: PROFILE.track },
  continueLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: PROFILE.white,
  },
  continueLabelDisabled: { color: PROFILE.muted },
});
