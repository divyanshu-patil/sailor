import React, { useCallback, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { useSignUp } from "@clerk/expo";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeInLeft,
  FadeOutLeft,
  LinearTransition,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignupFormProvider, useSignupForm } from "./form-context";
import StepName from "./step-1-name";
import StepEmail from "./step-2-email";
import StepPassword from "./step-3-password";
import { Text } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentTransition,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import {
  AnimatedHost,
  AnimatedPressable,
} from "@/components/ui/animated/AnimatedComponents";
import { colord } from "colord";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STEP_COUNT = 3;
const ACTIVE_COLOR = "#B75C5C";
const INACTIVE_COLOR = "#E5E5EA";
const STEP_TITLES = ["Name", "Email", "Password"];

// ---- Top pagination, AnimatedStep, FooterButton --------------------------
// identical to the presentation and specialization wizards — see the Bonus
// section for extracting this into one shared component now that it's
// duplicated a third time.

const PaginationSegment = React.memo(
  ({ index, currentStep }: { index: number; currentStep: number }) => {
    const progress = useSharedValue(index <= currentStep ? 1 : 0);
    React.useEffect(() => {
      progress.value = withTiming(index <= currentStep ? 1 : 0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    }, [currentStep, index, progress]);
    const animatedStyle = useAnimatedStyle(() => ({
      width: `${progress.value * 100}%`,
    }));
    return (
      <View style={styles.segmentTrack}>
        <Animated.View
          style={[
            styles.segmentFill,
            { backgroundColor: ACTIVE_COLOR },
            animatedStyle,
          ]}
        />
      </View>
    );
  },
);
PaginationSegment.displayName = "PaginationSegment";

function TopPagination({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.paginationWrap}>
      <View style={styles.segmentsRow}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <PaginationSegment key={i} index={i} currentStep={currentStep} />
        ))}
      </View>
      <Animated.Text style={styles.stepLabel}>
        Step {currentStep + 1} of {STEP_COUNT} · {STEP_TITLES[currentStep]}
      </Animated.Text>
    </View>
  );
}

const AnimatedStep = React.memo(
  ({
    children,
    direction,
    stepKey,
  }: {
    children: React.ReactNode;
    direction: "forward" | "back";
    stepKey: number;
  }) => {
    const translateX = useSharedValue(
      direction === "forward" ? SCREEN_WIDTH : -SCREEN_WIDTH,
    );
    const opacity = useSharedValue(0);
    React.useEffect(() => {
      translateX.value =
        direction === "forward" ? SCREEN_WIDTH * 0.25 : -SCREEN_WIDTH * 0.25;
      opacity.value = 0;
      translateX.value = withSpring(0, {
        damping: 18,
        stiffness: 160,
        mass: 0.6,
      });
      opacity.value = withTiming(1, { duration: 220 });
    }, [stepKey, direction, translateX, opacity]);
    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }],
    }));
    return (
      <Animated.View style={[styles.stepContainer, animatedStyle]}>
        {children}
      </Animated.View>
    );
  },
);
AnimatedStep.displayName = "AnimatedStep";

const FooterButton = React.memo(
  ({
    label,
    onPress,
    variant,
    disabled,
    currentStep,
  }: {
    label: string;
    onPress: () => void;
    variant: "primary" | "secondary";
    disabled?: boolean;
    currentStep: number;
  }) => {
    const pressed = useSharedValue(0);
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: withTiming(pressed.value ? 0.97 : 1, { duration: 100 }) },
      ],
    }));
    return (
      <AnimatedPressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => (pressed.value = 1)}
        onPressOut={() => (pressed.value = 0)}
        entering={FadeInLeft.duration(250).withInitialValues({
          opacity: 0,
          transform: [{ translateX: -20 }, { scale: 0.7 }],
        })}
        exiting={FadeOutLeft.duration(150)}
        layout={LinearTransition.springify().damping(75)}
        style={[
          styles.footerButton,
          variant === "primary"
            ? styles.footerButtonPrimary
            : styles.footerButtonSecondary,
          disabled && {
            backgroundColor: colord(ACTIVE_COLOR)
              .lighten(0.12)
              .desaturate(0.5)
              .toHex(),
          },
          animatedStyle,
        ]}
      >
        <AnimatedHost
          layout={LinearTransition.springify().damping(100)}
          matchContents
          modifiers={[animation(Animation.default, currentStep)]}
        >
          <Text
            modifiers={[
              foregroundStyle(variant === "primary" ? "#fff" : "#000"),
              contentTransition("numericText", { countsDown: false }),
              animation(Animation.spring(), currentStep),
            ]}
          >
            {label}
          </Text>
        </AnimatedHost>
      </AnimatedPressable>
    );
  },
);
FooterButton.displayName = "FooterButton";

// Flow content

function FlowContent() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const {
    isNameValid,
    isEmailValid,
    isPasswordValid,
    getSnapshot,
    setErrorMessage,
    setEmailValidationRequested,
  } = useSignupForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const isSubmitting = fetchStatus === "fetching";

  const stepIsValid = [isNameValid, isEmailValid, isPasswordValid][currentStep];

  const goBack = useCallback(() => {
    if (currentStep === 0) {
      router.back();
      return;
    }
    setDirection("back");
    setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleCreateAccount = useCallback(async () => {
    setErrorMessage(null);
    const { firstName, lastName, email, password } = getSnapshot();

    try {
      const { error } = await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName: lastName || undefined,
      });

      if (error) {
        console.error(JSON.stringify(error, null, 2));
        const emailError = errors.fields.emailAddress?.message;
        const passwordError = errors.fields.password?.message;

        if (emailError) {
          // Send them back to fix the email rather than showing the error
          // on the password step they're currently on.
          setErrorMessage(emailError);
          setDirection("back");
          setCurrentStep(1);
        } else {
          setErrorMessage(
            passwordError ??
              "Something went wrong. Please check your details and try again.",
          );
        }
        return;
      }

      await signUp.verifications.sendEmailCode();
      // Reuses the same verification screen as sign-in — Clerk decides which
      // flow is active. See "Wiring" below for the redirect change needed
      // inside verify.tsx once the code is confirmed.
      router.push("/(unauthenticated)/verify");
    } catch (err) {
      console.error("Sign up error:", JSON.stringify(err, null, 2));
      setErrorMessage("Something went wrong. Please try again.");
    }
  }, [signUp, errors, getSnapshot, setErrorMessage]);

  const goNext = useCallback(() => {
    if (currentStep === 1) {
      setEmailValidationRequested(true);

      if (!isEmailValid) {
        return;
      }
    }

    if (currentStep < STEP_COUNT - 1) {
      setDirection("forward");
      setCurrentStep((s) => s + 1);
      return;
    }

    handleCreateAccount();
  }, [
    currentStep,
    handleCreateAccount,
    isEmailValid,
    setEmailValidationRequested,
  ]);

  return (
    <SafeAreaView style={styles.flex} edges={["bottom"]}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        <TopPagination currentStep={currentStep} />

        <View style={styles.container}>
          <AnimatedStep stepKey={currentStep} direction={direction}>
            {currentStep === 0 && <StepName />}
            {currentStep === 1 && <StepEmail />}
            {currentStep === 2 && <StepPassword />}
          </AnimatedStep>
        </View>
      </View>

      <View style={styles.footer}>
        <FooterButton
          label="Back"
          onPress={goBack}
          variant="secondary"
          currentStep={currentStep}
        />
        <FooterButton
          label={
            currentStep < STEP_COUNT - 1
              ? "Next"
              : isSubmitting
                ? "Creating account…"
                : "Continue"
          }
          onPress={goNext}
          variant="primary"
          disabled={!stepIsValid || isSubmitting}
          currentStep={currentStep}
        />
      </View>
    </SafeAreaView>
  );
}

FlowContent.displayName = "FlowContent";

export default function SignupScreen() {
  return (
    <SignupFormProvider>
      <FlowContent />
    </SignupFormProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    gap: 50,
  },
  paginationWrap: {
    paddingHorizontal: 20,
    marginTop: 72,
    paddingBottom: 14,
    gap: 8,
  },
  segmentsRow: { flexDirection: "row", gap: 6 },
  segmentTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: INACTIVE_COLOR,
    overflow: "hidden",
  },
  segmentFill: { flex: 1, height: "100%", borderRadius: 2 },
  stepLabel: { fontSize: 13, fontWeight: "600", color: "#8E8E93" },
  stepContainer: { flex: 1 },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  footerButton: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 12,
  },
  footerButtonPrimary: { backgroundColor: ACTIVE_COLOR },
  footerButtonSecondary: { backgroundColor: "#ddd" },
});
