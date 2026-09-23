import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router, type Href } from "expo-router";

import PressableScale from "@/components/ui/animated/PressableScale";
import { HandwrittenNote } from "@/components/ui/handwritten-note";
import { useNicknameAvailability } from "@/hooks/use-nickname-availability";
import { isNicknameTakenError } from "@/services/onboarding.service";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import MorphingAvatar from "../components/morphing-avatar";
import OnboardingInput from "../components/onboarding-input";
import OnboardingScreen from "../components/onboarding-screen";
import type { OnboardingController } from "../hooks/use-onboarding-controller";

/** Continue only unlocks once the nickname is at least this many characters. */
const MIN_NICKNAME_LENGTH = 2;

/**
 * Step 1 — the nickname.
 *
 * The avatar is a `MorphingAvatar`: a pink circle until there is a name, then a
 * Blobatar seeded from the nickname. Same nickname, same face — that is why the
 * seed is the nickname and nothing else (no userId, no timestamp). Each new
 * face morphs in as the old one lifts away.
 */
export default function ProfileIdentityStep({
  controller,
  authenticated,
}: {
  controller: OnboardingController;
  authenticated: boolean;
}) {
  const { width } = useWindowDimensions();
  const avatarSize = Math.min(width * 0.54, 232);

  // Restored from the persisted draft, so a force-close mid-typing resumes.
  // `typed` is null until the user edits, so a value that arrives later from
  // hydration (or another device) is shown without fighting their own typing.
  const persisted = controller.state?.data.nickname ?? "";
  const [typed, setTyped] = useState<string | null>(null);
  const nickname = typed ?? persisted;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const availability = useNicknameAvailability(nickname);

  const handleChange = (text: string) => {
    setTyped(text);
    setSubmitError(null);
    // Local-only write, so a kill after this keystroke restores the draft.
    // Deliberately not the network: answers sync when the step is committed.
    controller.setDraftNickname(text);
  };

  const busy = submitting || controller.committing;
  const hasEnoughChars = nickname.trim().length >= MIN_NICKNAME_LENGTH;
  // Gated on length (and not on a syntactically invalid value). The
  // availability check still runs and reports, but does not hold the button
  // back — the authoritative claim happens after sign-up regardless.
  const canContinue =
    hasEnoughChars && availability.status !== "invalid" && !busy;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const next = await controller.submitNickname(availability.display);
      if (next === null) {
        // Flow finished. Post-auth, the account flag is already flipped and the
        // root guard moves on — this makes the hand-off immediate. Pre-auth,
        // push Create Account on top of this flow rather than replacing it
        // away, so Create Account's back button returns to this last step.
        if (authenticated) {
          router.replace("/(profile-setup)" as Href);
        } else {
          router.push({
            pathname: "/(unauthenticated)",
            params: { createAccount: "1", from: "onboarding" },
          } as Href);
        }
      }
    } catch (error) {
      if (isNicknameTakenError(error)) {
        // Someone claimed it between the check and the save. Re-ask the server
        // so the screen shows the authoritative "taken", not a client guess.
        availability.recheck();
        setSubmitError("Someone just took that nickname. Try another.");
      } else {
        setSubmitError(
          "Couldn't save your nickname. Check your connection and try again.",
        );
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
        <Text style={styles.heading}>{"What should\nwe call you?"}</Text>
        <Text style={styles.subtitle}>
          Let’s make this a little more personal.
        </Text>

        <View style={styles.avatarArea}>
          <View
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
          </View>

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
        </View>

        <View style={styles.form}>
          <View style={styles.helloRow}>
            <Text style={styles.helloLabel}>Hello,</Text>
            <OnboardingInput
              value={nickname}
              onChangeText={handleChange}
              placeholder="Add Name"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              accessibilityLabel="Add your name"
            />
          </View>
          <Text style={styles.helper}>You can always change this later.</Text>

          {availability.status === "checking" ? (
            <Text style={styles.statusMuted} accessibilityLiveRegion="polite">
              Checking availability…
            </Text>
          ) : null}
          {availability.message && availability.status !== "checking" ? (
            <Text
              style={[
                styles.status,
                availability.status === "available" && styles.statusOk,
              ]}
              accessibilityLiveRegion="polite"
            >
              {availability.message}
            </Text>
          ) : null}
          {availability.status === "available" ? (
            <Text style={[styles.status, styles.statusOk]}>
              {availability.display} is available.
            </Text>
          ) : null}
          {submitError ? (
            <Text style={styles.statusError} accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          ) : null}
          {controller.syncError ? (
            <Text style={styles.statusMuted}>{controller.syncError}</Text>
          ) : null}
        </View>
      </View>
    </OnboardingScreen>
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
  status: {
    marginTop: 8,
    fontFamily: profileFonts.medium,
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
  statusOk: { color: "#4C8C5B" },
  statusError: {
    marginTop: 8,
    fontFamily: profileFonts.medium,
    fontSize: 13,
    color: "#C0392B",
    textAlign: "center",
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
