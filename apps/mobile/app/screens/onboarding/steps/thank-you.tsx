import { type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { PROFILE, profileFonts } from "@/screens/profile/theme";
import SkiaMascot from "@/components/ui/skia-mascot";
import { THANK_YOU_MASCOT } from "@/constants/mascots";

interface Benefit {
  icon: ComponentProps<typeof Ionicons>["name"];
  /** Badge tint, and the little strokes above it. */
  badge: string;
  accent: string;
  label: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: "person",
    badge: "#FBE4EC",
    accent: "#F27CA0",
    label: "A personalized\nlearning plan",
  },
  {
    icon: "stats-chart",
    badge: "#E4F3E7",
    accent: "#3FB878",
    label: "Practice that\nfits your goals",
  },
  {
    icon: "heart",
    badge: "#EDE7FB",
    accent: "#9B7BE8",
    label: "A more confident\nyou",
  },
];

/**
 * Step 7 — the celebration after the last question. Not a question: it thanks
 * the user and names what their answers unlock. Continue hands off to account
 * creation, exactly like the step before it used to.
 */
export default function ThankYouStep() {
  return (
    <View style={styles.body}>
      <View style={styles.hero}>
        <Text style={styles.note}>{"You're\none step closer\nalready!"}</Text>
        <Ionicons
          name="arrow-forward"
          size={26}
          color={PROFILE.muted}
          style={styles.arrow}
        />
        {/* The canvas is ~2x the character; the negative margin keeps the
            hero's height what the old 200pt drawing gave it. */}
        <SkiaMascot
          source={THANK_YOU_MASCOT.source}
          width={MASCOT_CANVAS}
          style={styles.mascot}
        />
        <Ionicons name="heart" size={42} color="#F7A8C4" style={styles.heart} />
      </View>

      <Text style={styles.heading}>{"Thank you for\ntrusting us!"}</Text>
      <View style={styles.underline} />

      <Text style={styles.subtitle}>
        Your answers help us personalize your experience and create a better
        speaking journey for you.
      </Text>

      <View style={styles.benefits}>
        {BENEFITS.map((benefit) => (
          <View key={benefit.label} style={styles.benefit}>
            <View style={[styles.badge, { backgroundColor: benefit.badge }]}>
              <View style={styles.spark}>
                <View
                  style={[
                    styles.sparkLine,
                    styles.sparkLineA,
                    { backgroundColor: benefit.accent },
                  ]}
                />
                <View
                  style={[
                    styles.sparkLine,
                    styles.sparkLineB,
                    { backgroundColor: benefit.accent },
                  ]}
                />
              </View>
              <Ionicons name={benefit.icon} size={26} color={PROFILE.ink} />
            </View>
            <Text style={styles.benefitLabel}>{benefit.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const MASCOT_CANVAS = 360;

const styles = StyleSheet.create({
  mascot: { marginVertical: -(MASCOT_CANVAS - 190) / 2 },
  body: {
    flex: 1,
  },
  hero: {
    alignItems: "center",
    marginTop: 60,
  },
  note: {
    position: "absolute",
    top: -4,
    left: 0,
    fontFamily: profileFonts.handwritten,
    fontSize: 18,
    lineHeight: 23,
    color: PROFILE.muted,
  },
  arrow: {
    position: "absolute",
    top: 40,
    left: 78,
    transform: [{ rotate: "35deg" }],
  },
  heart: {
    position: "absolute",
    top: 8,
    right: 26,
    transform: [{ rotate: "12deg" }],
  },
  heading: {
    marginTop: 20,
    fontFamily: profileFonts.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
    textAlign: "center",
    color: PROFILE.ink,
  },
  underline: {
    alignSelf: "center",
    marginTop: 4,
    width: 232,
    height: 9,
    borderRadius: 5,
    backgroundColor: PROFILE.accentYellow,
    transform: [{ rotate: "-1deg" }],
  },
  subtitle: {
    marginTop: 18,
    fontFamily: profileFonts.body,
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center",
    color: PROFILE.muted,
  },
  benefits: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
  },
  benefit: {
    flex: 1,
    alignItems: "center",
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  spark: {
    position: "absolute",
    top: -9,
    right: -6,
    width: 16,
    height: 14,
  },
  sparkLine: {
    position: "absolute",
    width: 3,
    height: 10,
    borderRadius: 2,
  },
  sparkLineA: {
    left: 2,
    top: 2,
    transform: [{ rotate: "-28deg" }],
  },
  sparkLineB: {
    left: 9,
    top: 0,
    transform: [{ rotate: "6deg" }],
  },
  benefitLabel: {
    marginTop: 12,
    fontFamily: profileFonts.medium,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    color: PROFILE.ink,
  },
});
