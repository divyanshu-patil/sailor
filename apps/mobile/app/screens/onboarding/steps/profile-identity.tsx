import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { HandwrittenNote } from "@/components/ui/handwritten-note";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import { validateNickname } from "@/utils/nickname";
import MorphingAvatar from "../components/morphing-avatar";
import OnboardingInput from "../components/onboarding-input";
import type { OnboardingController } from "../hooks/use-onboarding-controller";
import Animated, { LinearTransition } from "react-native-reanimated";

/**
 * Step 1 — the nickname.
 *
 * Content only: the shared `OnboardingScreen` owns the progress bar and the
 * Continue button, and the flow shell owns the submit. This renders the
 * question and writes the draft as the user types.
 *
 * The avatar is a `MorphingAvatar`: a pink circle until there is a name, then a
 * Blobatar seeded from the nickname. Same nickname, same face — that is why the
 * seed is the nickname and nothing else (no userId, no timestamp). Each new
 * face morphs in as the old one lifts away.
 */
export default function ProfileIdentityStep({
  controller,
  error,
  onChange,
}: {
  controller: OnboardingController;
  error: string | null;
  onChange: (text: string) => void;
}) {
  const { width } = useWindowDimensions();
  const avatarSize = Math.min(width * 0.54, 232);

  // The draft is the single source, so a value restored from the persisted
  // record shows without a second copy to keep in sync.
  const nickname =
    typeof controller.state?.data.nickname === "string"
      ? controller.state.data.nickname
      : "";
  const validation = validateNickname(nickname);

  return (
    <View style={styles.body}>
      <Text style={styles.heading}>{"What should\nwe call you?"}</Text>
      <Text style={styles.subtitle}>
        Let’s make this a little more personal.
      </Text>

      <Animated.View
        layout={LinearTransition.springify()}
        style={styles.avatarArea}
      >
        <Animated.View
          layout={LinearTransition.springify()}
          style={{
            width: avatarSize + 48,
            height: avatarSize + 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Badge the avatar with a small marigold sparkle, as in the
              reference, without changing the avatar's own layout box. */}
          <View style={styles.sparkles} pointerEvents="none">
            <View style={[styles.spark, styles.sparkLeft]} />
            <View style={[styles.spark, styles.sparkRight]} />
          </View>

          <MorphingAvatar name={nickname} size={avatarSize} />
        </Animated.View>

        <HandwrittenNote
          lines={["Nice", "to meet", "you!"]}
          arrowSize={32}
          color={PROFILE.muted}
          fontFamily={profileFonts.handwritten}
          flip
          arrowX={10}
          arrowY={0}
          style={{ top: 50, right: -40 }}
        />
      </Animated.View>

      <View style={styles.form}>
        <View style={styles.helloRow}>
          <Animated.Text
            style={styles.helloLabel}
            layout={LinearTransition.springify()}
          >
            Hello,
          </Animated.Text>
          <OnboardingInput
            value={nickname}
            onChangeText={onChange}
            placeholder="Add Name"
            returnKeyType="done"
            accessibilityLabel="Add your name"
          />
        </View>
        <Text style={styles.helper}>You can always change this later.</Text>

        {nickname && !validation.valid ? (
          <Text style={styles.statusError} accessibilityLiveRegion="polite">
            {validation.message}
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.statusError} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {controller.syncError ? (
          <Text style={styles.statusMuted}>{controller.syncError}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: "center",
  },
  heading: {
    marginTop: 16,
    fontFamily: profileFonts.display,
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -1.2,
    color: PROFILE.ink,
    textAlign: "center",
  },
  helloRow: {
    marginTop: 4,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  helloLabel: {
    fontFamily: profileFonts.display,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -1,
    color: PROFILE.ink,
  },
  subtitle: {
    marginTop: 12,
    fontFamily: profileFonts.body,
    fontSize: 16,
    color: PROFILE.muted,
    textAlign: "center",
  },
  avatarArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  sparkles: {
    position: "absolute",
    top: 4,
    left: 6,
    flexDirection: "row",
  },
  spark: {
    width: 6,
    height: 18,
    borderRadius: 3,
    backgroundColor: PROFILE.accentYellow,
    marginHorizontal: 3,
  },
  sparkLeft: { transform: [{ rotate: "-24deg" }] },
  sparkRight: { transform: [{ rotate: "18deg" }] },
  form: {
    width: "100%",
    paddingBottom: 4,
  },
  helper: {
    marginTop: 12,
    fontFamily: profileFonts.body,
    fontSize: 13,
    color: PROFILE.muted,
    textAlign: "center",
  },
  statusMuted: {
    marginTop: 8,
    fontFamily: profileFonts.body,
    fontSize: 13,
    color: PROFILE.muted,
    textAlign: "center",
  },
  statusError: {
    marginTop: 8,
    fontFamily: profileFonts.medium,
    fontSize: 13,
    color: "#C0392B",
    textAlign: "center",
  },
});
