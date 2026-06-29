import React, { useCallback, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolateColor,
  Easing,
  createAnimatedComponent,
  FadeInLeft,
  FadeOutLeft,
  LinearTransition,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { PresentationFormProvider, usePresentationForm } from "./form-context";
import StepDescription from "./step-1-description";
import StepDurationAudience from "./step-2-duration-audience";
import StepCardCount from "./step-3-card-count";
import { Host, Text } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentTransition,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { colord } from "colord";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STEP_COUNT = 3;
const ACTIVE_COLOR = "#c11b5c";
const INACTIVE_COLOR = "#E5E5EA";

const STEP_TITLES = ["Describe", "Audience", "Cards"];

const AnimatedPressable = createAnimatedComponent(Pressable);
const AnimatedHost = createAnimatedComponent(Host);

// ---- Top pagination bar -------------------------------------------------

function PaginationSegment({
  index,
  currentStep,
}: {
  index: number;
  currentStep: number;
}) {
  const progress = useSharedValue(index <= currentStep ? 1 : 0);

  // Re-run whenever currentStep changes.
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
}

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

// ---- Animated step transition -------------------------------------------

function AnimatedStep({
  children,
  direction,
  stepKey,
}: {
  children: React.ReactNode;
  direction: "forward" | "back";
  stepKey: number;
}) {
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
    // stepKey intentionally re-triggers this effect on every step change.
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
}

// ---- Footer nav buttons ---------------------------------------------------

function FooterButton({
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
}) {
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
}

// ---- Flow content (needs context, so split from provider) ---------------

function FlowContent() {
  const { form, descriptionValue } = usePresentationForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const goNext = useCallback(() => {
    if (currentStep < STEP_COUNT - 1) {
      setDirection("forward");
      setCurrentStep((s) => s + 1);
    } else {
      // Final step — hand off to your generation pipeline.
      console.log("Generate presentation with:", form);
    }
  }, [currentStep, form]);

  const goBack = useCallback(() => {
    if (currentStep === 0) {
      router.back();
      return;
    }
    setDirection("back");
    setCurrentStep((s) => s - 1);
  }, [currentStep]);

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <TopPagination currentStep={currentStep} />

      <View style={styles.flex}>
        <AnimatedStep stepKey={currentStep} direction={direction}>
          {currentStep === 0 && <StepDescription />}
          {currentStep === 1 && <StepDurationAudience />}
          {currentStep === 2 && <StepCardCount />}
        </AnimatedStep>
      </View>

      <View style={styles.footer}>
        {currentStep > 0 ? (
          <FooterButton
            label={"Back"}
            onPress={goBack}
            variant="secondary"
            currentStep={currentStep}
          />
        ) : null}
        <FooterButton
          label={currentStep < 2 ? "Next" : "Generate"}
          onPress={goNext}
          variant="primary"
          currentStep={currentStep}
          disabled={descriptionValue.length <= 0}
        />
      </View>
    </SafeAreaView>
  );
}

export default function CreateNewScriptScreen() {
  return (
    <PresentationFormProvider>
      <FlowContent />
    </PresentationFormProvider>
  );
}

// ---- Styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  paginationWrap: {
    paddingHorizontal: 20,
    marginTop: 72,
    paddingBottom: 14,
    gap: 8,
  },
  segmentsRow: {
    flexDirection: "row",
    gap: 6,
  },
  segmentTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: INACTIVE_COLOR,
    overflow: "hidden",
  },
  segmentFill: {
    flex: 1,
    height: "100%",
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
  },
  stepContainer: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  footerButton: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    // paddingHorizontal: 24,
    flex: 1,
    paddingVertical: 12,
  },
  footerButtonText: {
    color: "white",
  },
  footerButtonPrimary: {
    backgroundColor: ACTIVE_COLOR,
  },
  footerButtonSecondary: {
    backgroundColor: "#ddd",
  },
  footerButtonDisabled: {
    opacity: 0.4,
  },
  footerButtonTextPrimary: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  footerButtonTextSecondary: {
    color: "#1C1C1E",
    fontSize: 16,
    fontWeight: "600",
  },
});
