import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  InteractionManager,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router, Stack, useIsFocused } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import Animated, {
  FadeInDown,
  FadeOutDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { PresentationFormProvider, usePresentationForm } from "./form-context";
import StepDescription from "./step-1-description";
import StepDelivery from "./step-2-delivery";
import StepOutput from "./step-3-output";
import Icon from "@react-native-vector-icons/lucide";
import { matchFont } from "@shopify/react-native-skia";
import { TextMorph } from "@/screens/presentation/generation/components/text-morph";
import { fonts } from "@/constants/fonts";

import { haptics, weight } from "@/lib/haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STEP_COUNT = 3;
const RUST = "#C57C7C";

export const CANVAS = "#E9E4E0";
const SEGMENT_COLOR = "#6F6B67";
/** The active segment is wide enough to read as "you are here" without a label. */
const SEGMENT_ACTIVE_WIDTH = 76;
const SEGMENT_IDLE_WIDTH = 34;

const BUTTON_HEIGHT = 62;
const LABEL_SIZE = 18;
/** Krona is the family the preview's morph already renders with. Skia matches
 *  by *family* name through its own font manager, not by the PostScript name
 *  React Native's `fontFamily` takes — ask it for "AlanSans-Regular" and it
 *  matches nothing, hands back a font with no typeface, and that font measures
 *  zero and draws nothing. */
const LABEL_FAMILY = fonts.krona;
/** Room the footer occupies over the steps that show it, above the inset. */
const FOOTER_SPACE = BUTTON_HEIGHT + 24;
/** The pagination bar's own height, which is what stands between the top of the
 *  screen and the top of a step. A step that wants to cover the whole screen —
 *  step three's cards do — has to be told how far up that is. */
const TOPBAR_H = 33;

// Matches ScriptGenerateRequest.description's min_length on the API.
const MIN_DESCRIPTION_LENGTH = 10;

const SPRING = { damping: 18, stiffness: 160, mass: 0.6 } as const;

// ---- Top pagination bar -------------------------------------------------

const PaginationSegment = React.memo(
  ({ index, currentStep }: { index: number; currentStep: number }) => {
    const width = useSharedValue(
      index === currentStep ? SEGMENT_ACTIVE_WIDTH : SEGMENT_IDLE_WIDTH,
    );

    React.useEffect(() => {
      width.value = withSpring(
        index === currentStep ? SEGMENT_ACTIVE_WIDTH : SEGMENT_IDLE_WIDTH,
        { damping: 18, stiffness: 180, mass: 0.6 },
      );
    }, [currentStep, index, width]);

    const animatedStyle = useAnimatedStyle(() => ({ width: width.value }));

    return <Animated.View style={[styles.segment, animatedStyle]} />;
  },
);

PaginationSegment.displayName = "PaginationSegment";

function TopBar({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.segmentsRow}>
      {Array.from({ length: STEP_COUNT }).map((_, i) => (
        <PaginationSegment key={i} index={i} currentStep={currentStep} />
      ))}
    </View>
  );
}

// ---- Step layers ---------------------------------------------------------

/**
 * One step, stacked on the others and shown by animation rather than by
 * mounting.
 *
 * Every step in this wizard is expensive to build — SwiftUI hosts, gesture
 * handlers, a Skia canvas — and building one while a transition is running is
 * what dropped the frame rate: the React commit and the native mount land in
 * the same frames the spring is trying to use. Once a step is mounted it stays
 * mounted, so a step change is one small render and three style updates.
 */
const StepLayer = React.memo(
  ({
    index,
    step,
    reserveFooter,
    children,
  }: {
    index: number;
    /** The wizard's position. */
    step: number;
    /** Points of bottom room to leave for the footer, 0 when it isn't shown. */
    reserveFooter?: number;
    children: React.ReactNode;
  }) => {
    const active = index === step;
    const animatedStyle = useAnimatedStyle(() => {
      const distance = index - step;
      return {
        opacity: withTiming(distance === 0 ? 1 : 0, { duration: 200 }),
        transform: [
          { translateX: withSpring(distance * SCREEN_WIDTH * 0.25, SPRING) },
        ],
      };
    });

    return (
      <Animated.View
        style={[
          styles.layer,
          !!reserveFooter && { paddingBottom: reserveFooter },
          animatedStyle,
        ]}
        // An inactive layer is invisible but still laid out, so it has to be
        // told to keep its hands off the touches.
        pointerEvents={active ? "auto" : "none"}
      >
        {children}
      </Animated.View>
    );
  },
);
StepLayer.displayName = "StepLayer";

// ---- Footer --------------------------------------------------------------
// Mounted only while it is wanted, and taken away by `exiting` — so when a dial
// in step two claims the screen the buttons leave with it, on the same commit,
// rather than lingering a beat as a prop change works its way through.

/** How long the pair takes to clear out. Short: they are getting out of the
 *  way of something else, not making an exit. */
const FOOTER_OUT_MS = 130;

const Footer = React.memo(
  ({
    label,
    bottomInset,
    onBack,
    onNext,
    disabled,
    isFinal,
  }: {
    label: string;
    bottomInset: number;
    onBack: () => void;
    onNext: () => void;
    disabled?: boolean;
    /** The last step, where "Continue" has become "Generate". */
    isFinal?: boolean;
  }) => {
    // The label's box hugs its text so the button can centre it. `TextMorph`
    // lays characters out from the left of whatever width it is given, so a
    // box the size of the button would leave the words against its edge.
    //
    // Measured the way it lays out — per character, summed — because the
    // bounds of the whole string are tighter than the advances it will use.
    // The floor keeps the box visible even if the family ever stops matching.
    const labelWidth = useMemo(() => {
      const font = matchFont({
        fontSize: LABEL_SIZE,
        fontFamily: LABEL_FAMILY,
      });
      let width = 0;
      for (const character of label) {
        const advance = font.measureText(character).width;
        width += advance > 0 ? advance : LABEL_SIZE * 0.28;
      }
      return Math.max(110, Math.ceil(width) + 8);
    }, [label]);

    return (
      <Animated.View
        style={[styles.footer, { paddingBottom: bottomInset + 12 }]}
        pointerEvents="box-none"
        exiting={FadeOutDown.duration(FOOTER_OUT_MS)}
        // Back leads and Continue follows, so the pair reads left to right.
      >
        <Animated.View entering={FadeInDown.duration(260)}>
          <Pressable
            onPress={() => {
              haptics.stepBack();
              onBack();
            }}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Icon name="chevron-left" size={26} color="#1B1B1B" />
          </Pressable>
        </Animated.View>
        <Animated.View
          style={styles.continueWrap}
          entering={FadeInDown.duration(260).delay(80)}
        >
          <Pressable
            disabled={disabled}
            // "Generate" is not another Continue — it spends a generation and
            // leaves the form behind, so it lands as a commit rather than a
            // step. Pressable does not fire onPress while disabled, so a
            // blocked step stays silent without a check of its own.
            onPress={() => {
              if (isFinal) {
                weight.firm();
              } else {
                haptics.stepForward();
              }
              onNext();
            }}
            style={({ pressed }) => [
              styles.continueButton,
              disabled && styles.continueButtonDisabled,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            {/* The same per-character morph the preview screen uses for
              stop/stopped: Continue → Generate rewrites itself letter by
              letter. It replaced a SwiftUI host, which laid its content out
              top-leading against a size that only settled a layout pass later
              — so the label sat high until some other update corrected it. */}
            <Animated.View
              style={{ width: labelWidth }}
              layout={LinearTransition.springify().damping(18)}
            >
              <TextMorph
                text={label}
                fontSize={LABEL_SIZE}
                fontFamily={LABEL_FAMILY}
                color="#FFFFFF"
                maxWidth={labelWidth}
                maxLines={1}
              />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  },
);
Footer.displayName = "Footer";

// ---- Flow content (needs context, so split from provider) ---------------

function FlowContent() {
  const { form, descriptionValue, isUploading } = usePresentationForm();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);

  // How much of the wizard has been built. The later steps are expensive, so
  // they go up in the quiet after the push animation — one per tick, so no
  // single commit is large — rather than in the middle of a step change.
  const [warm, setWarm] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const task = InteractionManager.runAfterInteractions(() => {
      // Staggered, and after the push animation has had its own time: the
      // point is to spend idle frames, never the ones something is moving in.
      timers.push(setTimeout(() => setWarm(1), 250));
      timers.push(setTimeout(() => setWarm(2), 650));
    });
    return () => {
      task.cancel();
      timers.forEach(clearTimeout);
    };
  }, []);

  // The step and the brief, mirrored where a callback can read them without
  // being rebuilt. `form` changes on every keystroke, and a nav handler that
  // changed with it would re-render the footer — SwiftUI host and all — on
  // every letter typed into step one.
  const stepRef = useRef(0);
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const goTo = useCallback((next: number) => {
    stepRef.current = next;
    // Nothing should ever be waiting on the warm-up; if the user is quicker
    // than it is, the step goes up now.
    setWarm((w) => Math.max(w, next));
    setCurrentStep(next);
  }, []);

  const goNext = useCallback(() => {
    const step = stepRef.current;
    if (step < STEP_COUNT - 1) {
      goTo(step + 1);
      return;
    }
    // Final step — hand off to the generation pipeline.
    router.navigate({
      pathname: "/(authenticated)/(script)/preview",
      params: { form: JSON.stringify(formRef.current) },
    });
  }, [goTo]);

  // Step 0 is left to the native back button in the route's toolbar.
  //
  // Past that, one back button serves two depths: a card in step three that has
  // taken the whole screen is what "back" means while it is open, and only once
  // it is closed does back mean the previous step. Step three parks its way out
  // here rather than drawing a second chevron over the route's own.
  const overlayClose = useRef<(() => void) | null>(null);
  const goBack = useCallback(() => {
    const close = overlayClose.current;
    if (close) {
      close();
      return;
    }
    goTo(Math.max(0, stepRef.current - 1));
  }, [goTo]);

  // Past the first step, leaving the screen means stepping back through the
  // wizard: the swipe and the native back button walk the steps instead of
  // popping the route and throwing the brief away.
  //
  // Only while this is the screen on top. Preview's Create resets the stack out
  // from under the wizard, and a guard still armed at step three swallowed that
  // reset — results never mounted, so the deck build was never requested.
  const isFocused = useIsFocused();
  usePreventRemove(currentStep > 0 && isFocused, goBack);

  // The same two gates the footer button used: the API's own min_length, and
  // "every file has landed" — a brief can't reference an id that doesn't exist.
  const canAdvance =
    descriptionValue.trim().length >= MIN_DESCRIPTION_LENGTH && !isUploading;

  const built = (index: number) => index <= Math.max(warm, currentStep);

  // Each step's element is memoised on what that step actually depends on.
  // Without this, a keystroke in step one re-renders every mounted step —
  // including the third one's slider, which is a few dozen views of its own.
  const description = useMemo(
    () => (
      <StepDescription
        onSend={goNext}
        canSend={canAdvance}
        active={currentStep === 0}
      />
    ),
    [goNext, canAdvance, currentStep],
  );
  // A dial in step two takes over the whole screen while it is being dragged.
  // That state is a gesture, not a page, so the footer gets out of its way —
  // unmounting, and coming back the same way it does on a step change.
  const [dialFocused, setDialFocused] = useState(false);
  const delivery = useMemo(
    () => <StepDelivery onFocusChange={setDialFocused} />,
    [],
  );
  const output = useMemo(
    () => (
      <StepOutput
        onFocusChange={setDialFocused}
        insetTop={insets.top + TOPBAR_H}
        insetBottom={FOOTER_SPACE + insets.bottom}
        closeRef={overlayClose}
      />
    ),
    [insets.top, insets.bottom],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <TopBar currentStep={currentStep} />

      <View style={styles.flex}>
        <StepLayer index={0} step={currentStep}>
          {description}
        </StepLayer>

        {built(1) && (
          <StepLayer
            index={1}
            step={currentStep}
            reserveFooter={FOOTER_SPACE + insets.bottom}
          >
            {delivery}
          </StepLayer>
        )}

        {built(2) && (
          <StepLayer
            index={2}
            step={currentStep}
            reserveFooter={FOOTER_SPACE + insets.bottom}
          >
            {output}
          </StepLayer>
        )}
      </View>

      {built(1) && currentStep > 0 && !dialFocused && (
        <Footer
          label={currentStep < STEP_COUNT - 1 ? "Continue" : "Generate"}
          isFinal={currentStep === STEP_COUNT - 1}
          bottomInset={insets.bottom}
          onBack={goBack}
          onNext={goNext}
          disabled={!canAdvance}
        />
      )}
    </SafeAreaView>
  );
}

FlowContent.displayName = "FlowContent";

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
  screen: { flex: 1, backgroundColor: CANVAS },
  segmentsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingTop: 24,
    paddingBottom: 4,
  },
  segment: {
    height: 5,
    borderRadius: 3,
    backgroundColor: SEGMENT_COLOR,
  },
  // Every step occupies the same box; only one of them is visible. The base
  // opacity is 0 so a step that is built in the background starts from hidden
  // — animating down from the default 1 would flash it over the live step.
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 96,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    backgroundColor: "#F7F5F3",
    alignItems: "center",
    justifyContent: "center",
  },
  continueWrap: { flex: 1 },
  continueButton: {
    width: "100%",
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    backgroundColor: RUST,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonDisabled: { opacity: 0.5 },
});
