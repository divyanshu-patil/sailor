import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import OrganicBlob from "@/components/ui/organic-blob";
import { ensureNotificationPermission } from "@/lib/daily-reminder";
import {
  PROFILE,
  PROFILE_PASTELS,
  profileFonts,
} from "@/screens/profile/theme";
import type { OnboardingStepId } from "@/types/onboarding";
import { usePreferenceStore } from "@/store/preference-store";
import { validateNickname } from "@/utils/nickname";
import OnboardingProgress from "./components/onboarding-progress";
import {
  FIRST_STEP_ID,
  ONBOARDING_STEPS,
  stepIndex,
  progressForStep,
} from "./config/steps";
import { useOnboardingScope } from "./hooks/use-onboarding-scope";
import BuildStreakStep from "./steps/build-streak";
import GenderStep from "./steps/gender";
import HomeWidgetStep from "./steps/home-widget";
import ImproveAreasStep from "./steps/improve-areas";
import NotificationsStep from "./steps/notifications";
import ProfileIdentityStep from "./steps/profile-identity";
import ReferralStep from "./steps/referral";
import ReminderTimeStep from "./steps/reminder-time";
import SpeakingContextsStep from "./steps/speaking-contexts";
import SpeakingLevelStep from "./steps/speaking-level";
import ThankYouStep from "./steps/thank-you";

/** Room for the floating Continue pill: its height, its padding and a gap. */
const CONTINUE_CLEARANCE = 58 + 12 + 8;
/** A two-choice footer: the primary pill, a gap, the secondary pill. */
const ASK_CLEARANCE = 58 + 10 + 54 + 12 + 8;

/**
 * Steps whose footer is a choice rather than Continue. The primary pill is
 * the thing the step is asking for; the secondary always moves on too — none
 * of these steps is a gate, and a dead-end "no" is how onboarding loses people.
 */
const CHOICES: Partial<
  Record<
    OnboardingStepId,
    { primary: string; secondary: string; arrow?: boolean }
  >
> = {
  notifications: {
    primary: "Allow notifications",
    secondary: "Not now",
    arrow: true,
  },
  home_widget: { primary: "Add widget", secondary: "Maybe later?" },
  build_streak: {
    primary: "Let\u2019s get started",
    secondary: "Maybe later",
    arrow: true,
  },
  reminder_time: {
    primary: "Set reminder",
    secondary: "Skip for now",
    arrow: true,
  },
};

/** iOS has no API to add a widget for the user, so the button teaches the
 *  three taps and resolves once they have been read. */
function explainWidget(): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(
      "Add the Sailors widget",
      "1. Touch and hold an empty spot on your Home Screen\n2. Tap Edit, then Add Widget\n3. Search for Sailors and pick a size",
      [{ text: "Got it", onPress: () => resolve() }],
      { cancelable: true, onDismiss: () => resolve() },
    );
  });
}

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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which footer pill is in flight, so only that one shows the spinner.
  const [pressed, setPressed] = useState<"primary" | "secondary" | null>(null);
  // Set the moment this mount hands off to Create Account. Only then does a
  // completed record fall back to its last step, so backing out of that screen
  // can still walk the flow. A record that was already complete when the user
  // opens onboarding again (e.g. Get started a second time) is a fresh run and
  // starts at the first step.
  const [handedOff, setHandedOff] = useState(false);

  // The persisted position, or — after a hand-off that completed the flow — the
  // last step it reached. `reviewStep` is a local cursor for walking back; it
  // never touches the stored record.
  const controllerStep = controller.currentStepId;
  const completedSteps = controller.state?.completedSteps ?? [];
  const lastCompleted = ONBOARDING_STEPS.filter((s) =>
    completedSteps.includes(s.id),
  ).at(-1)?.id;
  const [reviewStep, setReviewStep] = useState<OnboardingStepId | null>(null);
  const step =
    controllerStep ??
    reviewStep ??
    (handedOff ? lastCompleted : null) ??
    FIRST_STEP_ID;

  const busy = submitting || controller.committing;

  const canContinue = (() => {
    if (busy) return false;
    switch (step) {
      case "profile_identity":
        return validateNickname(nickname).valid;
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
      case "improve_areas":
        return (
          Array.isArray(data.improvementAreas) &&
          data.improvementAreas.length > 0
        );
      case "thank_you":
      case "notifications":
      case "home_widget":
      case "build_streak":
      case "reminder_time":
        return true;
      default:
        return false;
    }
  })();

  const handOff = () => {
    setHandedOff(true);
    if (authenticated) {
      router.replace("/(profile-setup)" as Href);
    } else {
      router.push({
        pathname: "/(unauthenticated)",
        params: { createAccount: "1", from: "onboarding" },
      } as Href);
    }
  };

  /** `accept` only matters on the choice steps: whether the primary pill
   *  (rather than the secondary) was tapped. */
  const handleContinue = async (accept = false) => {
    if (!canContinue) return;
    // Leaving review mode: the commit below owns the position again.
    setReviewStep(null);
    setSubmitting(true);
    setError(null);
    try {
      let next: OnboardingStepId | null = null;
      switch (step) {
        case "profile_identity":
          next = await controller.submitNickname(
            validateNickname(nickname).display,
          );
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
        case "improve_areas":
          next = await controller.submitImprovementAreas(
            (data.improvementAreas as string[]) ?? [],
          );
          break;
        case "thank_you":
          next = await controller.submitThankYou();
          break;
        case "notifications": {
          // A failed prompt is a "no", not a stuck screen — the reminder
          // settings can ask again later.
          const granted = accept
            ? await ensureNotificationPermission().catch(() => false)
            : false;
          next = await controller.submitStep("notifications", {
            notificationsAllowed: granted,
          });
          break;
        }
        case "home_widget":
          if (accept) await explainWidget();
          next = await controller.submitStep("home_widget", {
            widgetPromptAccepted: accept,
          });
          break;
        case "build_streak":
          next = await controller.submitStep("build_streak", {
            streakIntroAccepted: accept,
          });
          break;
        case "reminder_time": {
          const time =
            typeof data.reminderTime === "string"
              ? data.reminderTime
              : usePreferenceStore.getState().preferences.practiceReminderTime;
          // The preference store is what the reminder scheduler watches
          // (lib/daily-reminder), so writing it is what schedules the nudge.
          if (accept) {
            usePreferenceStore.getState().setPreferences({
              practiceReminderTime: time,
              practiceRemindersEnabled: true,
            });
          }
          next = await controller.submitStep("reminder_time", {
            reminderTime: accept ? time : null,
          });
          break;
        }
      }
      // The commit already moved the persisted position, so the content below
      // swaps in place. Only the very end leaves the screen.
      if (!next) handOff();
    } catch {
      setError("Couldn't save your answer. Check your connection and retry.");
    } finally {
      setSubmitting(false);
      setPressed(null);
    }
  };

  const choice = CHOICES[step];
  const ask = !!choice;

  const content = ((): ReactNode => {
    switch (step) {
      case "profile_identity":
        return (
          <ProfileIdentityStep
            controller={controller}
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
      case "improve_areas":
        return <ImproveAreasStep controller={controller} />;
      case "thank_you":
        return <ThankYouStep />;
      case "notifications":
        return <NotificationsStep />;
      case "home_widget":
        return <HomeWidgetStep />;
      case "build_streak":
        return <BuildStreakStep />;
      case "reminder_time":
        return <ReminderTimeStep controller={controller} />;
    }
  })();

  const index = stepIndex(step);
  // Which way the flow just moved, so a step slides in from the side it came
  // from. Previous-value-in-state rather than a ref: the entering/exiting pair
  // has to be chosen in the same render that swaps the page's key.
  const [nav, setNav] = useState({ index, direction: 1 });
  if (nav.index !== index) {
    setNav({ index, direction: index > nav.index ? 1 : -1 });
  }
  const direction =
    index === nav.index ? nav.direction : index > nav.index ? 1 : -1;

  if (!controller.hydrated || !controller.state) {
    return <View style={styles.placeholder} />;
  }

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
        <View style={styles.content}>
          {/* One page per step, keyed so the outgoing page plays its exit
              while the incoming one enters — a short slide and fade, the
              chrome around them never moving. */}
          <Animated.View
            key={step}
            entering={(direction > 0 ? FadeInRight : FadeInLeft)
              .duration(340)
              .withInitialValues({
                transform: [{ translateX: direction * 36 }],
              })}
            exiting={(direction > 0 ? FadeOutLeft : FadeOutRight).duration(200)}
            style={[styles.page, { top: headerHeight }]}
          >
            <ScrollView
              style={styles.flex}
              contentContainerStyle={[
                styles.scrollBody,
                {
                  paddingBottom:
                    (ask ? ASK_CLEARANCE : CONTINUE_CLEARANCE) +
                    Math.max(insets.bottom, 16),
                },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              alwaysBounceVertical
            >
              {content}
            </ScrollView>
          </Animated.View>
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {choice ? (
            <Animated.View
              key={step}
              entering={FadeInRight.duration(260)}
              style={styles.askActions}
            >
              <PressableScale
                onPress={() => {
                  setPressed("primary");
                  void handleContinue(true);
                }}
                disabled={busy}
                style={styles.continue}
                accessibilityRole="button"
                accessibilityLabel={choice.primary}
              >
                {busy && pressed === "primary" ? (
                  <ActivityIndicator color={PROFILE.white} />
                ) : (
                  <>
                    <Text style={styles.continueLabel}>{choice.primary}</Text>
                    {choice.arrow ? (
                      <Ionicons
                        name="arrow-forward"
                        size={22}
                        color={PROFILE.white}
                        style={styles.continueArrow}
                      />
                    ) : null}
                  </>
                )}
              </PressableScale>
              <PressableScale
                onPress={() => {
                  setPressed("secondary");
                  void handleContinue(false);
                }}
                disabled={busy}
                style={styles.secondary}
                accessibilityRole="button"
                accessibilityLabel={choice.secondary}
              >
                {busy && pressed === "secondary" ? (
                  <ActivityIndicator color={PROFILE.ink} />
                ) : (
                  <Text style={styles.secondaryLabel}>{choice.secondary}</Text>
                )}
              </PressableScale>
            </Animated.View>
          ) : (
            <PressableScale
              onPress={() => void handleContinue()}
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
          )}
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
  },
  // Inset on the scroll content, not its container, so a step's decoration
  // may break out to the screen edge without the scroll view clipping it.
  page: { position: "absolute", left: 0, right: 0, bottom: 0 },
  scrollBody: { flexGrow: 1, paddingHorizontal: 28 },
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
  continueArrow: { position: "absolute", right: 26 },
  askActions: { gap: 10 },
  secondary: {
    height: 54,
    borderRadius: 999,
    backgroundColor: "#F1E7DB",
    borderWidth: 1,
    borderColor: "#EADFD1",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: PROFILE.ink,
  },
  continueLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: PROFILE.white,
  },
  continueLabelDisabled: { color: PROFILE.muted },
});
