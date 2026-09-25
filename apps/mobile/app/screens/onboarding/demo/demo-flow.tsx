import { type RefObject, useEffect, useLayoutEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import BlobBackground from "@/screens/presentation/generation/components/background";
import {
  PresentationFormProvider,
  usePresentationForm,
} from "@/screens/presentation/new-script/form-context";
import StepDelivery from "@/screens/presentation/new-script/step-2-delivery";
import StepOutput from "@/screens/presentation/new-script/step-3-output";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import {
  type DemoDetail,
  type DemoOption,
  onboardingDemoService,
} from "@/services/onboarding-demo.service";
import { AUDIENCE_OPTIONS } from "@/types/presentation";
import { CONTINUE_CLEARANCE } from "../config/footer";
import {
  DECK_HOLD_MS,
  DEMO_STAGES,
  type DemoActions,
  type DemoFooter,
  type DemoStage,
  footerFor,
  SCRIPT_HOLD_MS,
} from "./demo-footer";
import DemoPicker from "./demo-picker";
import {
  DemoDeck,
  DemoDeckViewer,
  type DemoPhase,
  DemoScript,
} from "./demo-result";

export type { DemoActions, DemoFooter, DemoStage } from "./demo-footer";

const COPY: Partial<
  Record<DemoStage, { step: number; title: string; hint: string }>
> = {
  pick: {
    step: 1,
    title: "Make your first script",
    hint: "Pick a brief. We'll do the writing.",
  },
  // Step two brings its own heading; the chip is all it needs from here.
  delivery: { step: 2, title: "", hint: "" },
  output: {
    step: 3,
    title: "Length and cue cards",
    hint: "Tap a card to change it, or just generate.",
  },
};

interface DemoFlowProps {
  /** The speaking contexts from onboarding, to pick briefs for. */
  contexts: string[];
  /** Distance from the top of the screen to the top of this view. */
  headerHeight: number;
  /** The safe-area bottom the frame's footer sits above. */
  safeBottom: number;
  actionsRef: RefObject<DemoActions | null>;
  onFooterChange: (footer: DemoFooter) => void;
  /** The demo is over, with the script and deck it made. */
  onFinish: (demo: DemoDetail) => void;
}

/**
 * The script-and-deck demo, as one onboarding step.
 *
 * It walks the real wizard: a brief (picked here instead of typed), then the
 * wizard's own step two and step three — the dials and the length/cards — and
 * then the preview and results screens' pieces showing the script and deck
 * arriving. Only the generation is different: the result was made ahead of
 * time by the same pipeline and stored on the server, so it's instant.
 */
export default function DemoFlow(props: DemoFlowProps) {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <PresentationFormProvider>
        {/* The first stage arrives with the onboarding page's own slide-in;
            a second entrance of its own inside that one, started in the same
            commit, could stall at zero opacity and leave the step blank. Later
            stages still animate in. */}
        <LayoutAnimationConfig skipEntering>
          <DemoStages {...props} />
        </LayoutAnimationConfig>
      </PresentationFormProvider>
    </GestureHandlerRootView>
  );
}

function DemoStages({
  contexts,
  headerHeight,
  safeBottom,
  actionsRef,
  onFooterChange,
  onFinish,
}: DemoFlowProps) {
  const {
    setMood,
    setProfession,
    setAudienceIndex,
    setDurationMinutes,
    setCardCount,
    handleSetDescriptionValue,
  } = usePresentationForm();

  const [stage, setStage] = useState<DemoStage>("pick");
  const [direction, setDirection] = useState(1);
  const [options, setOptions] = useState<DemoOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<DemoOption | null>(null);
  const [demo, setDemo] = useState<DemoDetail | null>(null);
  // Which demo has had its "generating" beat, per result. Phases are derived
  // from these, so a different brief generates afresh and stepping back to a
  // result that already arrived doesn't generate it twice.
  const [scriptHeldFor, setScriptHeldFor] = useState<string | null>(null);
  const [deckHeldFor, setDeckHeldFor] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [contentTop, setContentTop] = useState(0);
  const [closeCard] = useState<{ current: (() => void) | null }>(() => ({
    current: null,
  }));

  const contextKey = contexts.join(",");

  useEffect(() => {
    let live = true;
    onboardingDemoService
      .listDemos(contextKey ? contextKey.split(",") : [])
      .then((list) => {
        if (live) setOptions(list);
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
    };
  }, [contextKey, attempt]);

  // The stored result is fetched the moment a brief is picked, so it has the
  // whole walk through the dials to arrive.
  useEffect(() => {
    if (!selected) return;
    let live = true;
    onboardingDemoService
      .getDemo(selected.id)
      .then((detail) => {
        if (live) setDemo(detail);
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
    };
  }, [selected]);

  // The generating state holds for a beat before the result shows — and past
  // that for as long as the result is still on its way.
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    if (!selectedId) return;
    const pending =
      stage === "script" && scriptHeldFor !== selectedId
        ? { hold: SCRIPT_HOLD_MS, done: setScriptHeldFor }
        : stage === "deck" && deckHeldFor !== selectedId
          ? { hold: DECK_HOLD_MS, done: setDeckHeldFor }
          : null;
    if (!pending) return;
    const timer = setTimeout(() => pending.done(selectedId), pending.hold);
    return () => clearTimeout(timer);
  }, [stage, selectedId, scriptHeldFor, deckHeldFor]);

  const arrived = !!demo && demo.id === selectedId;
  const scriptPhase: DemoPhase =
    arrived && scriptHeldFor === selectedId ? "completed" : "generating";
  const deckPhase: DemoPhase =
    arrived && deckHeldFor === selectedId ? "completed" : "generating";

  const goTo = (next: DemoStage) => {
    setDirection(
      DEMO_STAGES.indexOf(next) >= DEMO_STAGES.indexOf(stage) ? 1 : -1,
    );
    setStage(next);
    setFocused(false);
  };

  // The finished deck opens in place. `focused` is what already moves the
  // footer out of the way for the dials, so the open deck reuses it.
  const deckOpen = stage === "deck" && focused && deckPhase === "completed";
  const openDeck = () => setFocused(true);
  const closeDeck = () => setFocused(false);
  // The page steps back while its deck is open, leaving the backdrop — the
  // opened cards sit on the same ground rather than on a sheet.
  const pageShown = useSharedValue(1);
  useEffect(() => {
    pageShown.value = withTiming(deckOpen ? 0 : 1, { duration: 200 });
  }, [deckOpen, pageShown]);
  const pageFade = useAnimatedStyle(() => ({ opacity: pageShown.value }));

  const select = (option: DemoOption) => {
    // A different brief is a different script; the old one mustn't show.
    if (option.id !== selected?.id) setDemo(null);
    setSelected(option);
    // The wizard's own form, preset to exactly what the stored script was made
    // with — so the dials the user is walked through show the real settings.
    handleSetDescriptionValue(option.brief);
    setMood(option.mood);
    setProfession(option.profession);
    setAudienceIndex(
      Math.max(
        0,
        AUDIENCE_OPTIONS.findIndex((a) => a.value === option.audience),
      ),
    );
    setDurationMinutes(option.durationMinutes);
    setCardCount(option.cardCount);
  };

  const footer = footerFor(stage, {
    selected: !!selected,
    scriptPhase,
    deckPhase,
    focused,
  });

  useEffect(() => {
    onFooterChange(footer);
    // Keyed on the fields, not the object, which is new every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    footer.primary,
    footer.enabled,
    footer.hidden,
    footer.selecting,
    footer.arrow,
  ]);

  useLayoutEffect(() => {
    actionsRef.current = {
      primary: () => {
        if (stage === "pick" && selected) goTo("delivery");
        else if (stage === "delivery") goTo("output");
        else if (stage === "output") goTo("script");
        else if (stage === "script" && scriptPhase === "completed")
          goTo("deck");
        else if (stage === "deck" && deckPhase === "completed" && demo)
          onFinish(demo);
      },
      back: () => {
        if (deckOpen) {
          closeDeck();
          return true;
        }
        if (closeCard.current) {
          closeCard.current();
          return true;
        }
        const index = DEMO_STAGES.indexOf(stage);
        if (index <= 0) return false;
        // Stepping back from a result goes to the settings, not into a second
        // "generating" of something already generated.
        goTo(stage === "deck" ? "script" : DEMO_STAGES[index - 1]);
        return true;
      },
    };
  });

  const copy = COPY[stage];
  const clearance = CONTINUE_CLEARANCE + safeBottom;
  // The script and the deck are made on the preview screen's blob backdrop,
  // edge to edge: one backdrop for both, so moving from one to the other only
  // moves the content, and it drifts only while something is being made.
  const onBlobs = stage === "script" || stage === "deck";
  const making =
    (stage === "script" && scriptPhase === "generating") ||
    (stage === "deck" && deckPhase === "generating");

  const onContentLayout = (e: LayoutChangeEvent) =>
    setContentTop(e.nativeEvent.layout.y);

  const body = (() => {
    switch (stage) {
      case "pick":
        return (
          <Animated.ScrollView
            style={styles.fill}
            contentContainerStyle={[
              styles.pickScroll,
              { paddingBottom: clearance + 12 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <DemoPicker
              options={options}
              selectedId={selected?.id ?? null}
              onSelect={select}
              error={loadError}
              onRetry={() => {
                setLoadError(false);
                setAttempt((n) => n + 1);
              }}
            />
          </Animated.ScrollView>
        );
      case "delivery":
        return (
          <View style={[styles.fill, { paddingBottom: clearance }]}>
            <StepDelivery onFocusChange={setFocused} />
          </View>
        );
      case "output":
        return (
          <View style={[styles.fill, { paddingBottom: clearance }]}>
            <StepOutput
              onFocusChange={setFocused}
              insetTop={headerHeight + contentTop}
              insetBottom={clearance}
              closeRef={closeCard}
            />
          </View>
        );
      case "script":
        return (
          <DemoScript demo={demo} phase={scriptPhase} bottomInset={clearance} />
        );
      case "deck":
        return demo ? (
          <DemoDeck
            demo={demo}
            phase={deckPhase}
            bottomInset={clearance}
            onOpen={openDeck}
          />
        ) : null;
    }
  })();

  return (
    <View style={styles.fill}>
      {onBlobs ? (
        <Animated.View
          entering={FadeIn.duration(420)}
          exiting={FadeOut.duration(220)}
          pointerEvents="none"
          // Up under the header too: this view starts below it.
          style={[styles.edge, { top: -headerHeight }]}
        >
          <BlobBackground animate={making} />
        </Animated.View>
      ) : null}
      {copy ? (
        <Animated.View
          key={`copy-${stage}`}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(120)}
          style={styles.copy}
        >
          <View style={styles.stepChip}>
            <Text
              style={styles.stepChipLabel}
            >{`Try it · ${copy.step} of 3`}</Text>
          </View>
          {copy.title ? <Text style={styles.title}>{copy.title}</Text> : null}
          {copy.hint ? <Text style={styles.hint}>{copy.hint}</Text> : null}
        </Animated.View>
      ) : null}
      <View style={styles.fill} onLayout={onContentLayout}>
        <Animated.View
          key={stage}
          entering={(direction > 0 ? FadeInRight : FadeInLeft).duration(280)}
          exiting={FadeOut.duration(140)}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View style={[styles.fill, pageFade]}>{body}</Animated.View>
        </Animated.View>
      </View>
      {deckOpen && demo ? (
        <View style={[styles.edge, { top: -headerHeight }]}>
          <DemoDeckViewer
            demo={demo}
            topInset={headerHeight}
            bottomInset={safeBottom}
            onClose={closeDeck}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  edge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  copy: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 14,
  },
  stepChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F8E4A9",
  },
  stepChipLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 12.5,
    color: "#85661F",
  },
  title: {
    marginTop: 10,
    fontFamily: profileFonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    color: PROFILE.ink,
  },
  hint: {
    marginTop: 6,
    fontFamily: profileFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: PROFILE.muted,
  },
  pickScroll: {
    paddingHorizontal: 28,
    paddingTop: 4,
  },
});
