import { type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { haptics } from "@/lib/haptics";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import {
  pillMark,
  SelectionMark,
  selectedBorder,
  Stagger,
} from "../components/choice-motion";
import BlobMascot, { type BlobEyes } from "../components/blob-mascot";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

/** The pills' height. */
const CARD_HEIGHT = 92;

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
 * Step 3 — where the user heard about Sailors. Content only; the shell owns
 * progress and Continue.
 */
export default function ReferralStep({
  controller,
}: {
  controller: OnboardingController;
}) {
  const selected =
    typeof controller.state?.data.referral === "string"
      ? controller.state.data.referral
      : null;

  return (
    <View style={styles.body}>
      <Text style={styles.heading}>{"Where did you\nhear about us?"}</Text>
      <View style={styles.underline} />
      <Text style={styles.subtitle}>
        This helps us make Sailors better for you.
      </Text>

      <View style={styles.options}>
        {OPTIONS.map((option, i) => {
          const active = selected === option.value;
          return (
            <Stagger key={option.value} index={i}>
              <PressableScale
                haptic={haptics.select}
                onPress={() => controller.setDraft({ referral: option.value })}
                style={[
                  styles.card,
                  { backgroundColor: option.card },
                  active && { borderColor: selectedBorder(option.card) },
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
                <SelectionMark active={active} style={pillMark(90)} />
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
    width: 220,
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
    minHeight: CARD_HEIGHT,
    marginBottom: 14,
    paddingLeft: 14,
    // The mascot's end, plus the check mark that sits just inside it.
    paddingRight: 118,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
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
});
