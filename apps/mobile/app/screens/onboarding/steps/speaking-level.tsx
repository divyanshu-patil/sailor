import { StyleSheet, Text, View } from "react-native";

import PressableScale from "@/components/ui/animated/PressableScale";
import { haptics } from "@/lib/haptics";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { SelectionMark, Stagger } from "../components/choice-motion";
import SquareMascot, { type SquareEyes } from "../components/square-mascot";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

interface LevelOption {
  /** Persisted value. */
  value: string;
  title: string;
  description: string;
  card: string;
  blob: string;
  accent: string;
  eyes: SquareEyes;
}

const OPTIONS: LevelOption[] = [
  {
    value: "just_starting",
    title: "Just Getting Started",
    description: "I often struggle to find the right words.",
    card: "#FCE4EC",
    blob: "#F7A8C4",
    accent: "#F27CA0",
    eyes: "open",
  },
  {
    value: "getting_comfortable",
    title: "Getting Comfortable",
    description: "I can speak, but sometimes I hesitate.",
    card: "#FDF3DC",
    blob: "#F8D98A",
    accent: "#F0B840",
    eyes: "open",
  },
  {
    value: "pretty_confident",
    title: "Pretty Confident",
    description: "I can express myself, but I want to sound better.",
    card: "#E4F3E7",
    blob: "#6FCB9A",
    accent: "#3FB878",
    eyes: "closed",
  },
  {
    value: "strong_speaker",
    title: "Strong Speaker",
    description: "I’m confident and want to sharpen my skills.",
    card: "#EDE7FB",
    blob: "#C3AEF0",
    accent: "#9B7BE8",
    eyes: "squint",
  },
];

/**
 * Step 4 — how the user describes themselves when speaking. Content only; the
 * shell owns progress and Continue.
 */
export default function SpeakingLevelStep({
  controller,
}: {
  controller: OnboardingController;
}) {
  const selected =
    typeof controller.state?.data.speakingLevel === "string"
      ? controller.state.data.speakingLevel
      : null;

  return (
    <View style={styles.body}>
      <Text style={styles.heading}>
        {"How would you describe\nyourself when speaking?"}
      </Text>
      <Text style={styles.subtitle}>There’s no right or wrong answer.</Text>

      <View style={styles.options}>
        {OPTIONS.map((option, i) => {
          const active = selected === option.value;
          return (
            <Stagger key={option.value} index={i}>
              <PressableScale
                haptic={haptics.select}
                onPress={() =>
                  controller.setDraft({ speakingLevel: option.value })
                }
                style={[
                  styles.card,
                  { backgroundColor: option.card },
                  active && styles.cardActive,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option.title}. ${option.description}`}
              >
                <View style={styles.mascotWrap}>
                  <SquareMascot
                    color={option.blob}
                    accent={option.accent}
                    eyes={option.eyes}
                    size={78}
                  />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.title}>{option.title}</Text>
                  <Text style={styles.description}>{option.description}</Text>
                </View>
                <SelectionMark active={active} />
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
    fontSize: 30,
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
    marginTop: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 116,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  cardActive: { borderColor: PROFILE.ink },
  mascotWrap: {
    width: 78,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontFamily: profileFonts.display,
    fontSize: 20,
    letterSpacing: -0.4,
    color: PROFILE.ink,
  },
  description: {
    marginTop: 4,
    fontFamily: profileFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: PROFILE.muted,
  },
});
