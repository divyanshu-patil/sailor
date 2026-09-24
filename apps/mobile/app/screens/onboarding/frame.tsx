import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router, Stack, type Href } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";

import PressableScale from "@/components/ui/animated/PressableScale";
import OrganicBlob from "@/components/ui/organic-blob";
import { useNicknameAvailability } from "@/hooks/use-nickname-availability";
import { isNicknameTakenError } from "@/services/onboarding.service";
import {
  PROFILE,
  PROFILE_PASTELS,
  profileFonts,
} from "@/screens/profile/theme";
import type { OnboardingStepId } from "@/types/onboarding";
import OnboardingProgress from "./components/onboarding-progress";
import {
  FIRST_STEP_ID,
  ONBOARDING_STEPS,
  stepIndex,
  progressForStep,
} from "./config/steps";
import { useOnboardingScope } from "./hooks/use-onboarding-scope";
import GenderStep from "./steps/gender";
import ProfileIdentityStep from "./steps/profile-identity";
import ReferralStep from "./steps/referral";
import SpeakingContextsStep from "./steps/speaking-contexts";
import SpeakingLevelStep from "./steps/speaking-level";

/** Continue unlocks once the nickname is at least this many characters. */
const MIN_NICKNAME_LENGTH = 2;
/** Room for the floating Continue pill: its height, its padding and a gap. */
const CONTINUE_CLEARANCE = 58 + 12 + 8;

/** The soft organic shapes behind every step — the app's shared warm ground. */
function OnboardingBackdrop() {
  const { width, height } = useWindowDimensions();
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 900 });
  }, [reveal]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <OrganicBlob
        seed="onboarding-sun"
        width={width * 0.7}
        height={width * 0.7}
        color="#FBEBCB"
        x={width * 0.55}
        y={-width * 0.28}
        opacity={0.9}
        complexity={6}
        contrast={0.3}
        revealProgress={reveal}
      />
      <OrganicBlob
        seed="onboarding-pink"
        width={width * 0.6}
        height={height * 0.42}
        color={PROFILE_PASTELS.pinkSoft}
        x={-width * 0.38}
        y={height * 0.5}
        opacity={0.8}
        complexity={5}
        contrast={0.3}
        revealProgress={reveal}
      />
      <OrganicBlob
        seed="onboarding-mint"
        width={width * 0.95}
        height={height * 0.46}
        color="#DCEFE0"
        x={width * 0.25}
        y={height * 0.7}
        opacity={0.8}
        complexity={6}
        contrast={0.3}
        revealProgress={reveal}
      />
    </View>
  );
}

/**
 * The single onboarding shell.
 *
 * The flow is one screen, like sign-up's wizard: the chrome — background,
 * back button, progress bar, pinned Continue — mounts once and only the inner
 * step content swaps. The step in view is the controller's persisted position,
 * so advancing commits the answer and moves the position, and Back walks it
 * backwards, without any route push or stack animation to remount the chrome.
 */
export default function OnboardingFrame() {
  const { controller, authenticated } = useOnboardingScope();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const headerHeight = useHeaderHeight();

  const data = controller.state?.data ?? {};
  const nickname = typeof data.nickname === "string" ? data.nickname : "";
  const availability = useNicknameAvailability(nickname);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The persisted position, or — once the flow is completed — the last step it
  // reached. Handing off to Create Account marks the flow completed and clears
  // `currentStepId`; backing out of that screen lands here again, and this keeps
  // the last step on screen so Back can still walk the whole flow. `reviewStep`
  // is a local cursor for that walk-back; it never touches the stored record.
  const controllerStep = controller.currentStepId;
  const completedSteps = controller.state?.completedSteps ?? [];
  const lastCompleted = ONBOARDING_STEPS.filter((s) =>
    completedSteps.includes(s.id),
  ).at(-1)?.id;
  const [reviewStep, setReviewStep] = useState<OnboardingStepId | null>(null);
  const step = controllerStep ?? reviewStep ?? lastCompleted ?? FIRST_STEP_ID;

  const busy = submitting || controller.committing;

  const canContinue = (() => {
    if (busy) return false;
    switch (step) {
      case "profile_identity":
        return (
          nickname.trim().length >= MIN_NICKNAME_LENGTH &&
          availability.status !== "invalid"
        );
      case "gender":
        return typeof data.gender === "string";
      case "referral":
        return typeof data.referral === "string";
      case "speaking_level":
        return typeof data.speakingLevel === "string";
      case "speaking_contexts":
        return (
          Array.isArray(data.speakingContexts) &&
          data.speakingContexts.length > 0
        );
      default:
        return false;
    }
  })();

  const handOff = () => {
    if (authenticated) {
      router.replace("/(profile-setup)" as Href);
    } else {
      router.push({
        pathname: "/(unauthenticated)",
        params: { createAccount: "1", from: "onboarding" },
      } as Href);
    }
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    // Leaving review mode: the commit below owns the position again.
    setReviewStep(null);
    setSubmitting(true);
    setError(null);
    try {
      let next: OnboardingStepId | null = null;
      switch (step) {
        case "profile_identity":
          next = await controller.submitNickname(availability.display);
          break;
        case "gender":
          next = await controller.submitGender(String(data.gender));
          break;
        case "referral":
          next = await controller.submitReferral(String(data.referral));
          break;
        case "speaking_level":
          next = await controller.submitSpeakingLevel(
            String(data.speakingLevel),
          );
          break;
        case "speaking_contexts":
          next = await controller.submitSpeakingContexts(
            (data.speakingContexts as string[]) ?? [],
          );
          break;
      }
      // The commit already moved the persisted position, so the content below
      // swaps in place. Only the very end leaves the screen.
      if (!next) handOff();
    } catch (e) {
      if (isNicknameTakenError(e)) {
        availability.recheck();
        setError("Someone just took that nickname. Try another.");
      } else {
        setError("Couldn't save your answer. Check your connection and retry.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const content = ((): ReactNode => {
    switch (step) {
      case "profile_identity":
        return (
          <ProfileIdentityStep
            controller={controller}
            availability={availability}
            error={error}
            onChange={(text) => {
              setError(null);
              controller.setDraft({ nickname: text });
            }}
          />
        );
      case "gender":
        return <GenderStep controller={controller} />;
      case "referral":
        return <ReferralStep controller={controller} />;
      case "speaking_level":
        return <SpeakingLevelStep controller={controller} />;
      case "speaking_contexts":
        return <SpeakingContextsStep controller={controller} />;
    }
  })();

  if (!controller.hydrated || !controller.state) {
    return <View style={styles.placeholder} />;
  }

  const index = stepIndex(step);
  const showBack = index > 0 || router.canGoBack();
  const handleBack = () => {
    if (index <= 0) {
      router.back();
    } else if (controllerStep) {
      controller.goBack();
    } else {
      // Completed record: walk back through the finished steps locally.
      setReviewStep(ONBOARDING_STEPS[index - 1].id);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <OnboardingBackdrop />

      {/* Back is a real header item (native glass), driving our in-place step
          walk; the progress bar rides the header title beside it. */}
      {showBack ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="chevron.backward"
            tintColor={PROFILE.ink}
            onPress={handleBack}
          />
        </Stack.Toolbar>
      ) : null}
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={{ width: width - 120 }}>
              <OnboardingProgress progress={progressForStep(step)} />
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.content, { paddingTop: headerHeight }]}>
          <ScrollView
            key={step}
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollBody,
              { paddingBottom: CONTINUE_CLEARANCE + Math.max(insets.bottom, 16) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical
          >
            {content}
          </ScrollView>
        </View>

        <View
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
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
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PROFILE.background },
  placeholder: { flex: 1, backgroundColor: PROFILE.background },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  scrollBody: { flexGrow: 1 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 28,
  },
  continue: {
    height: 58,
    borderRadius: 999,
    backgroundColor: PROFILE.ink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
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
