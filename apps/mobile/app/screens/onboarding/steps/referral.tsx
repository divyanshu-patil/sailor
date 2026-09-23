import { useState, type ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import BlobMascot, { type BlobEyes } from "../components/blob-mascot";
import OnboardingScreen from "../components/onboarding-screen";
import { stepRoute } from "../config/routes";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

interface ReferralOption {
  /** Persisted value. */
  value: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  card: string;
  badge: string;
  blob: string;
  accent: string;
  eyes: BlobEyes;
}

const OPTIONS: ReferralOption[] = [
  {
    value: "instagram",
    label: "Instagram",
    icon: "logo-instagram",
    card: "#FCE4EC",
    badge: "#F8C7D8",
    blob: "#F7A8C4",
    accent: "#F27CA0",
    eyes: "open",
  },
  {
    value: "tiktok",
    label: "TikTok",
    icon: "logo-tiktok",
    card: "#FDF3DC",
    badge: "#FBE3A8",
    blob: "#F7CF7E",
    accent: "#F0B840",
    eyes: "closed",
  },
  {
    value: "youtube",
    label: "YouTube",
    icon: "logo-youtube",
    card: "#E4F3E7",
    badge: "#BEE7CB",
    blob: "#9FD9B8",
    accent: "#5FC79A",
    eyes: "open",
  },
  {
    value: "friend_family",
    label: "Friend or family",
    icon: "people",
    card: "#EFE8FB",
    badge: "#D9CCF5",
    blob: "#C9B6F0",
    accent: "#A98BE8",
    eyes: "closed",
  },
  {
    value: "search",
    label: "Search",
    icon: "search",
    card: "#E7F0FC",
    badge: "#C7DDF7",
    blob: "#A9C6F0",
    accent: "#6D8BEA",
    eyes: "open",
  },
  {
    value: "other",
    label: "Other",
    icon: "ellipsis-horizontal",
    card: "#FDEAE2",
    badge: "#FBD3C0",
    blob: "#F7B0A6",
    accent: "#E86B5A",
    eyes: "squint",
  },
];

/**
 * Step 3 — where the user heard about Sailors.
 *
 * A single-choice list; the answer is stored on the step and only helps tailor
 * the app, so nothing is claimed against the account.
 */
export default function ReferralStep({
  controller,
  authenticated,
}: {
  controller: OnboardingController;
  authenticated: boolean;
}) {
  // Restored from the persisted draft, so a force-close mid-step resumes.
  const persisted =
    typeof controller.state?.data.referral === "string"
      ? controller.state.data.referral
      : null;
  const [selected, setSelected] = useState<string | null>(persisted);
  const [submitting, setSubmitting] = useState(false);

  const busy = submitting || controller.committing;
  const canContinue = selected !== null && !busy;

  const handleContinue = async () => {
    if (!canContinue || !selected) return;
    setSubmitting(true);
    try {
      const next = await controller.submitReferral(selected);
      if (next === null) {
        // Flow finished — same hand-off as the last step.
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
        <Text style={styles.heading}>{"Where did you\nhear about us?"}</Text>
        <View style={styles.underline} />
        <Text style={styles.subtitle}>
          This helps us make Sailors better for you.
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const active = selected === option.value;
            return (
              <PressableScale
                key={option.value}
                onPress={() => setSelected(option.value)}
                style={[
                  styles.card,
                  { backgroundColor: option.card },
                  active && styles.cardActive,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
              >
                <View style={[styles.badge, { backgroundColor: option.badge }]}>
                  <Ionicons name={option.icon} size={25} color={PROFILE.ink} />
                </View>
                <Text style={styles.label}>{option.label}</Text>
                <View style={styles.mascot}>
                  <BlobMascot
                    color={option.blob}
                    accent={option.accent}
                    eyes={option.eyes}
                    size={90}
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
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
    color: PROFILE.ink,
  },
  underline: {
    marginTop: 2,
    width: 200,
    maxWidth: "100%",
    height: 9,
    borderRadius: 5,
    backgroundColor: PROFILE.accentYellow,
    transform: [{ rotate: "-1deg" }],
  },
  subtitle: {
    marginTop: 16,
    maxWidth: "74%",
    fontFamily: profileFonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: PROFILE.muted,
  },
  hero: {
    position: "absolute",
    top: -12,
    right: -26,
  },
  options: {
    marginTop: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 92,
    marginBottom: 14,
    paddingLeft: 14,
    paddingRight: 86,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  cardActive: { borderColor: PROFILE.ink },
  badge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    marginLeft: 14,
    fontFamily: profileFonts.display,
    fontSize: 20,
    letterSpacing: -0.4,
    color: PROFILE.ink,
  },
  mascot: {
    position: "absolute",
    right: -8,
    bottom: -12,
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
