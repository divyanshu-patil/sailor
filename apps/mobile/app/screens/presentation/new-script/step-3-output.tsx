/* eslint-disable react-hooks/immutability -- the values written below are
   Reanimated shared values driven from worklets and one layout callback; the
   rule can't see that a SharedValue is meant to be mutated. */
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { weight } from "@/lib/haptics";
import Animated, {
  type SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { fonts } from "@/constants/fonts";
import { usePresentationForm } from "./form-context";
import {
  CARDS_PER_LAYER,
  CardsHero,
  ClockHero,
} from "./components/output-heroes";
import ValueDial from "./components/value-dial";

const { width: W, height: SCREEN_H } = Dimensions.get("window");

const PAD = 20;
const CARD_W = W - PAD * 2;
const CARD_GAP = 18;
const CARD_R = 30;
/** How much of the card behind shows when the two are stacked. */
const PEEK = 104;
/** Room kept above and below the pair, so neither runs into the pagination bar
 *  or the footer — and so the top card clears the back button rather than
 *  tucking under it. */
const VPAD = 32;
/** Finger travel that takes the stack from closed to open. */
const EXPAND_TRAVEL = 220;
/** And that takes an opened card all the way back down. */
const DISMISS_TRAVEL = 300;
/** How much of the drag still counts once it is past either end. */
const BEYOND = 0.4;

/** Share of the screen the opened card keeps. The rest is the dial. */
const HERO_SHARE = 0.6;
/** How far above the screen the opened card starts, so its top corners — which
 *  are round while it is a card — are never in view once it is a panel. */
const HERO_OVERSHOOT = 60;
const HERO_R = 40;

/** The card growing into a screen, and shrinking back. A spring rather than a
 *  curve: a zoom that arrives and settles is what makes it read as the card
 *  itself moving rather than a panel being resized. */
const OPEN_SPRING = { damping: 26, stiffness: 190, mass: 0.9 } as const;
/** Nothing to admire on the way out, so it goes back without overshooting. */
const CLOSE_SPRING = { damping: 32, stiffness: 260, mass: 0.8 } as const;

const CARDS = {
  title: "Cards",
  fill: "#DFA06A",
  ink: "#26221E",
  figure: "#B0743A",
  accent: "#E6A94E",
  deck: "#C0813F",
  word: "#B4453F",
  min: 4,
  max: 60,
  presets: [12, 24, 40],
  unit: "cards",
} as const;

const DURATION = {
  title: "Duration",
  fill: "#8093E0",
  ink: "#1D2038",
  figure: "#33469E",
  accent: "#8093E0",
  hand: "#38428C",
  tick: "#FFFFFF",
  face: "#F2D9A0",
  min: 2,
  max: 60,
  presets: [5, 10, 15],
  unit: "mins",
} as const;

interface StepOutputProps {
  /** Told when a card takes the screen, so the wizard's footer gets out of the
   *  way — the same signal step two uses for a focused dial. */
  onFocusChange: (focused: boolean) => void;
  /** Distance from the top of the screen to the top of this step, and from its
   *  bottom to the screen's. The opened card has to reach past both. */
  insetTop: number;
  insetBottom: number;
  /** Left holding this step's way out of an opened card, or null when there is
   *  nothing to come out of. The screen already has one back button — the
   *  route's own — and drawing a second over the first is what a card-turned-
   *  screen would otherwise need. */
  closeRef: React.RefObject<(() => void) | null>;
}

export default function StepOutput({
  onFocusChange,
  insetTop,
  insetBottom,
  closeRef,
}: StepOutputProps) {
  const { form, setCardCount, setDurationMinutes } = usePresentationForm();

  const [height, setHeight] = useState(0);
  const [expanded, setExpanded] = useState(false);
  /** Which card has taken the screen, or null. */
  const [openId, setOpenId] = useState<number | null>(null);

  /** 0 stacked, 1 side by side. Driven by the drag, so it is a shared value and
   *  the number rides it straight rather than a render behind. */
  const progress = useSharedValue(0);
  const start = useSharedValue(0);
  /** 0 a card, 1 a screen. */
  const open = useSharedValue(0);
  /** 1 while an opened card is being pulled back down, so the drag keeps
   *  meaning the same thing after `open` has fallen away from 1. */
  const grabbed = useSharedValue(0);

  const cardsRaw = useSharedValue(form.cardCount);
  const durationRaw = useSharedValue(form.durationMinutes);

  const heroTop = -(insetTop + HERO_OVERSHOOT);
  const heroH = HERO_SHARE * SCREEN_H + HERO_OVERSHOOT;
  const heroBottom = heroTop + heroH;

  const settle = useCallback((next: boolean) => setExpanded(next), []);

  // Closes over nothing that changes, so the gesture below can hold it and the
  // wizard's back button can be handed the same one.
  const clear = useCallback(() => setOpenId(null), []);

  const hide = useCallback(() => {
    onFocusChange(false);
    open.value = withSpring(0, CLOSE_SPRING, (finished) => {
      "worklet";
      if (finished) scheduleOnRN(clear);
    });
  }, [clear, onFocusChange, open]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(8)
        .activeOffsetY([-12, 12])
        .onStart(() => {
          grabbed.value = open.value > 0 ? 1 : 0;
          start.value = grabbed.value === 1 ? open.value : progress.value;
        })
        .onUpdate((e) => {
          // Pulling an opened card back down runs the whole zoom in reverse
          // under the finger, rather than waiting for a release to decide.
          //
          // Neither end stops it: past full screen it keeps stretching, and
          // past the card it keeps shrinking. What the ends do is resist, so
          // the card can only ever be dragged inside out with a pull longer
          // than the phone — and going nowhere is what a hard stop feels like.
          if (grabbed.value === 1) {
            const back = start.value - e.translationY / DISMISS_TRAVEL;
            open.value =
              back > 1
                ? 1 + (back - 1) * BEYOND
                : back < 0
                  ? back * BEYOND
                  : back;
            return;
          }
          const next = start.value + e.translationY / EXPAND_TRAVEL;
          progress.value = Math.min(Math.max(next, 0), 1);
        })
        .onFinalize((e) => {
          if (grabbed.value === 1) {
            grabbed.value = 0;
            // Far enough down, or thrown down: let it go. Otherwise it snaps
            // back up to full screen.
            if (open.value < 0.68 || e.velocityY > 900) scheduleOnRN(hide);
            else open.value = withSpring(1, OPEN_SPRING);
            return;
          }
          const out = progress.value + e.velocityY / 2600 > 0.5;
          progress.value = withSpring(out ? 1 : 0, { damping: 70 });
          scheduleOnRN(settle, out);
        }),
    [grabbed, hide, open, progress, settle, start],
  );

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    progress.value = withSpring(next ? 1 : 0, { damping: 70 });
  }, [expanded, progress]);

  const show = useCallback(
    (id: number) => {
      setOpenId(id);
      onFocusChange(true);
      weight.press();
      open.value = withSpring(1, OPEN_SPRING);
    },
    [onFocusChange, open],
  );

  // Refreshed every render, so what the wizard holds is never a stale `hide`.
  useEffect(() => {
    closeRef.current = openId === null ? null : hide;
  });

  const press = useCallback(
    (id: number) => (expanded ? show(id) : toggle()),
    [expanded, show, toggle],
  );

  const backdrop = useAnimatedStyle(() => ({ opacity: open.value }));

  const panel = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ translateY: (1 - open.value) * SCREEN_H * 0.5 }],
  }));

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height),
    [],
  );

  const cardH = (height - CARD_GAP - VPAD * 2) / 2;
  const stackTop = (height - (cardH + PEEK)) / 2;

  return (
    <View style={styles.root} onLayout={onLayout}>
      {height > 0 && (
        <GestureDetector gesture={pan}>
          <View style={styles.field}>
            <Animated.View
              style={[styles.backdrop, backdrop]}
              pointerEvents="none"
            />

            {openId !== null && (
              <Animated.View
                style={[
                  styles.panel,
                  { top: heroBottom, bottom: -insetBottom },
                  panel,
                ]}
              >
                {openId === 0 ? (
                  <ValueDial
                    value={form.cardCount}
                    min={CARDS.min}
                    max={CARDS.max}
                    unit={CARDS.unit}
                    presets={[...CARDS.presets]}
                    accent={CARDS.accent}
                    group={CARDS_PER_LAYER}
                    onChange={setCardCount}
                    raw={cardsRaw}
                  />
                ) : (
                  <ValueDial
                    value={form.durationMinutes}
                    min={DURATION.min}
                    max={DURATION.max}
                    unit={DURATION.unit}
                    presets={[...DURATION.presets]}
                    accent={DURATION.accent}
                    onChange={setDurationMinutes}
                    raw={durationRaw}
                  />
                )}
              </Animated.View>
            )}

            <OutputCard
              id={0}
              open={open}
              openId={openId}
              progress={progress}
              cardH={cardH}
              collapsedTop={stackTop}
              expandedTop={VPAD}
              heroTop={heroTop}
              heroH={heroH}
              fill={CARDS.fill}
              onPress={press}
            >
              <Text style={[styles.title, { color: CARDS.ink }]}>
                {CARDS.title}
              </Text>
              <Figure
                progress={progress}
                open={open}
                cardH={cardH}
                colour={CARDS.figure}
                value={form.cardCount}
              />
              {openId === 0 && (
                <Reveal open={open}>
                  <CardsHero
                    value={form.cardCount}
                    ink={CARDS.ink}
                    accent={CARDS.word}
                    deck={CARDS.deck}
                    gap={CARDS.fill}
                  />
                </Reveal>
              )}
            </OutputCard>

            <OutputCard
              id={1}
              open={open}
              openId={openId}
              progress={progress}
              cardH={cardH}
              collapsedTop={stackTop + PEEK}
              expandedTop={VPAD + cardH + CARD_GAP}
              heroTop={heroTop}
              heroH={heroH}
              fill={DURATION.fill}
              onPress={press}
            >
              <Text style={[styles.title, { color: DURATION.ink }]}>
                {DURATION.title}
              </Text>
              <Fade open={open} style={[styles.centre, styles.optical]}>
                <View style={styles.minutes}>
                  <Text style={[styles.figure, { color: DURATION.figure }]}>
                    {form.durationMinutes}
                  </Text>
                  <Text style={[styles.suffix, { color: DURATION.figure }]}>
                    min
                  </Text>
                </View>
              </Fade>
              {openId === 1 && (
                <Reveal open={open}>
                  <ClockHero
                    raw={durationRaw}
                    hand={DURATION.hand}
                    tick={DURATION.tick}
                    accent={DURATION.face}
                  />
                </Reveal>
              )}
            </OutputCard>
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

// ---- Pieces ---------------------------------------------------------------

/**
 * One card, and — once it is tapped — the screen it becomes.
 *
 * Its box is animated rather than transformed. A card and the panel it opens
 * into are different shapes, so a scale would have to be uneven, and an uneven
 * scale turns the corner radius into an ellipse for the length of the move.
 */
const OutputCard = memo(
  ({
    id,
    open,
    openId,
    progress,
    cardH,
    collapsedTop,
    expandedTop,
    heroTop,
    heroH,
    fill,
    onPress,
    children,
  }: {
    id: number;
    open: SharedValue<number>;
    openId: number | null;
    progress: SharedValue<number>;
    cardH: number;
    collapsedTop: number;
    expandedTop: number;
    heroTop: number;
    heroH: number;
    fill: string;
    onPress: (id: number) => void;
    children: React.ReactNode;
  }) => {
    const mine = openId === id;

    const style = useAnimatedStyle(() => {
      const o = mine ? open.value : 0;
      const stacked =
        collapsedTop + (expandedTop - collapsedTop) * progress.value;
      return {
        top: stacked + (heroTop - stacked) * o,
        left: PAD - PAD * o,
        width: CARD_W + (W - CARD_W) * o,
        height: cardH + (heroH - cardH) * o,
        borderRadius: CARD_R + (HERO_R - CARD_R) * o,
        backgroundColor: fill,
        // The card left behind goes while the other one grows over it.
        opacity: openId !== null && !mine ? 1 - open.value : 1,
      };
    });

    return (
      <Animated.View style={[styles.card, style]}>
        <Pressable
          onPress={() => onPress(id)}
          disabled={openId !== null}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </Animated.View>
    );
  },
);
OutputCard.displayName = "OutputCard";

/**
 * What the card only shows once it *is* a screen — the wordmark, the clock.
 *
 * Tied to the last stretch of the zoom, so on the way in it arrives after the
 * colour has the screen, and on the way down it is gone within the first inch
 * of the drag rather than riding it all the way to the bottom.
 */
const Reveal = memo(
  ({
    open,
    children,
  }: {
    open: SharedValue<number>;
    children: React.ReactNode;
  }) => {
    const style = useAnimatedStyle(() => ({
      opacity: interpolate(open.value, [0.72, 1], [0, 1], "clamp"),
    }));
    return (
      <Animated.View style={[styles.centre, style]} pointerEvents="none">
        {children}
      </Animated.View>
    );
  },
);
Reveal.displayName = "Reveal";

/** Anything the card shows as a card, and stops showing as a screen. */
const Fade = memo(
  ({
    open,
    style,
    children,
  }: {
    open: SharedValue<number>;
    style?: object;
    children: React.ReactNode;
  }) => {
    const fade = useAnimatedStyle(() => ({
      opacity: Math.max(0, 1 - open.value * 2.4),
    }));
    return (
      <Animated.View style={[style, fade]} pointerEvents="none">
        {children}
      </Animated.View>
    );
  },
);
Fade.displayName = "Fade";

/**
 * The card count, which travels rather than being redrawn: small in the corner
 * while the cards are stacked, and in the middle at full size once they are
 * apart, with everything in between belonging to the finger.
 */
const Figure = memo(
  ({
    progress,
    open,
    cardH,
    colour,
    value,
  }: {
    progress: SharedValue<number>;
    open: SharedValue<number>;
    cardH: number;
    colour: string;
    value: number;
  }) => {
    const style = useAnimatedStyle(() => {
      const t = progress.value;
      return {
        opacity: Math.max(0, 1 - open.value * 2.4),
        transform: [
          { translateX: interpolate(t, [0, 1], [CARD_W / 2 - 64, 0]) },
          { translateY: interpolate(t, [0, 1], [-(cardH / 2 - 54), 0]) },
          { scale: interpolate(t, [0, 1], [0.46, 1]) },
        ],
      };
    });

    return (
      <Animated.View
        style={[styles.centre, styles.optical, style]}
        pointerEvents="none"
      >
        <Text style={[styles.figure, { color: colour }]}>{value}</Text>
      </Animated.View>
    );
  },
);
Figure.displayName = "Figure";

const styles = StyleSheet.create({
  root: { flex: 1 },
  field: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -600,
    bottom: -600,
    backgroundColor: "#0E0E11",
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  card: { position: "absolute", overflow: "hidden" },
  title: {
    position: "absolute",
    left: 24,
    top: 26,
    fontSize: 30,
    letterSpacing: -0.5,
    fontFamily: fonts.krona,
  },
  centre: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Digits have no descenders, but the line keeps room for them below, so a
   *  centred number reads high. Starting the box lower centres the glyphs. */
  optical: { top: 18 },
  figure: {
    fontSize: 96,
    lineHeight: 108,
    letterSpacing: -3,
    fontFamily: fonts.alanSans.bold,
  },
  minutes: { flexDirection: "row", alignItems: "baseline" },
  suffix: {
    fontSize: 40,
    letterSpacing: -1,
    opacity: 0.8,
    fontFamily: fonts.alanSans.medium,
  },
});
