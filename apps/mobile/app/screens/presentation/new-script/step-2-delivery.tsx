/* eslint-disable react-hooks/immutability -- the values written below are
   Reanimated shared values driven from worklets and one layout callback; the
   rule can't see that a SharedValue is meant to be mutated. */
import { memo, useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { haptics, weight } from "@/lib/haptics";
import Animated, {
  Easing,
  FadeInRight,
  FadeOutLeft,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { fonts } from "@/constants/fonts";
import { MOOD_OPTIONS } from "@/types/settings/preferences";
import { PROFESSIONS } from "@/types/user";
import { usePresentationForm } from "./form-context";
import {
  AUDIENCE_DIAL,
  MOOD_DIAL,
  PROFESSION_DIAL,
  type DialOption,
} from "./components/dial-data";
import DialItem from "./components/dial-item";
import {
  ARC_R,
  CX,
  CIRCLE_R,
  ITEM_R,
  RING_R,
  STEP_C,
  arcCenterY,
  arcTop,
  focusCenterY,
  pickBand,
  ringStep,
  wrapIndex,
} from "./components/dial-geometry";

const INK = "#1B1B1B";
const SUBTLE = "#6E6862";

// ---- Focus transition -----------------------------------------------------
// Several things move when a dial takes over, and none of them is the same
// motion, so each gets its own pair of numbers. Nothing here is derived from
// anything else here — change one and only that one changes.
//
//   CIRCLE   the band's own circle swelling until its colour has the screen
//   WASH     the other two bands and the options that are not being dragged,
//            getting out of its way
//   MARKS    every band's name — SPEAKING AS, MOOD, AUDIENCE — and its ruler
//   SETTLE   the options travelling between their arc and the ring, and with
//            them the gesture's own sense of scale
//   CHROME   the dial's name, value, blurb, face and pointer
//
// CIRCLE and WASH are close cousins — the circle cannot cover what is drawn
// over it, so those things have to leave under their own steam — but they are
// not the same motion and are kept apart: run the wash slower than the circle
// and the bands dissolve through the colour instead of being buried by it.
//
// Opening, the colour arrives first and the options keep settling well after
// it — a circle looks full long before it has stopped growing, and letting the
// two land together makes the whole thing read as one cut. Closing, the order
// reverses: the options are home before the colour has finished draining, so
// they are never left sitting on the canvas.
// (For how fast the dials themselves turn, see STEP_TRAVEL in dial-geometry.)

const EASE_IN = Easing.out(Easing.cubic);
const EASE_OUT = Easing.out(Easing.poly(6));

type Timing = {
  circleIn: number;
  circleOut: number;
  washIn: number;
  washOut: number;
  marksIn: number;
  marksOut: number;
  /** Waited out before the names come back, on the way out only. */
  marksDelay: number;
  settleIn: number;
  settleOut: number;
  chromeInDelay: number;
  chromeIn: number;
  chromeOut: number;
};

/**
 * What a dial does unless it says otherwise.
 *
 * The circle is the beat everything else is set against. Anything much shorter
 * than it reads as a cut rather than a move — which is why the band names have
 * their own pair here and not the wash's: at 150 against a 1300 circle they
 * blinked out.
 */
const BASE: Timing = {
  circleIn: 1300,
  circleOut: 750,
  washIn: 150,
  washOut: 500,
  marksIn: 300,
  marksOut: 1300,
  marksDelay: 150,
  settleIn: 300,
  settleOut: 350,
  chromeInDelay: 150,
  chromeIn: 340,
  chromeOut: 150,
};

/**
 * Per dial, in the order they are stacked.
 *
 * Audience is the odd one out and gets its own circle. Every band's circle is
 * the same size and grows to the same radius, but the audience arc sits lowest,
 * so its centre is furthest below the phone and it has half again as far to
 * grow before its colour reaches the top of the screen — on the same duration
 * it reads noticeably slower than the other two. Its circle runs quicker to
 * land with them.
 */
const TIMING: Timing[] = [
  BASE,
  BASE,
  { ...BASE, circleIn: 1000, circleOut: 750 },
];

/** How quickly the middle of the ring changes hands at a detent. */
const SNAP = { damping: 24, stiffness: 300, mass: 0.5 } as const;

/**
 * The three dials, top to bottom. Order is the design's: the speaker first,
 * then the tone they take, then who is listening.
 */
const DIALS: {
  caption: string;
  color: string;
  /** Labels, on the band's own fill. */
  ink: string;
  /** Icons, inside the white bubbles. */
  glyph: string;
  options: DialOption[];
}[] = [
  {
    caption: "Speaking as",
    color: "#79B9A9",
    ink: "#FFFFFF",
    glyph: "#2E6B5D",
    options: PROFESSION_DIAL,
  },
  {
    caption: "Mood",
    color: "#EC96A6",
    ink: "#54262F",
    glyph: "#A8465A",
    options: MOOD_DIAL,
  },
  {
    caption: "Audience",
    color: "#F6D189",
    ink: "#4A3714",
    glyph: "#946D18",
    options: AUDIENCE_DIAL,
  },
];

const COUNTS = DIALS.map((d) => d.options.length);
const COLORS = DIALS.map((d) => d.color);

/** Tick marks between the options on a collapsed arc, as fractions of a step.
 *  Three to a gap, two gaps either side of the middle. */
const TICKS: { a: number; o: number }[] = [];
for (const gap of [-2, -1, 0, 1]) {
  for (const f of [0.33, 0.5, 0.67]) {
    const a = (gap + f) * STEP_C;
    TICKS.push({
      a,
      // Emphasis falls away from the middle, which is where the selection
      // always sits — so the gradient can be baked in rather than animated.
      o: Math.max(0.08, 0.5 - Math.abs(a) * 0.62),
    });
  }
}

/** The dial face drawn around the focused selection: a ring of ticks and a
 *  pointer at twelve o'clock. Both are fixed — the selection is always in the
 *  middle, so the face is what the options turn against. Whatever the step, no
 *  option ever lands on the top slot, which is why the pointer sits there. */
const FACE = Array.from({ length: 36 }, (_, i) => (i / 36) * Math.PI * 2);
const FACE_R = Math.round(RING_R * 0.68);
/** Left strip left to the navigator, so a back swipe still works over a band. */
const EDGE_SLOP = 26;
const POINTER_R = Math.round(RING_R * 0.8);
const PUCK = Math.round(RING_R * 0.9);

// ---- Layers ---------------------------------------------------------------
// The reveal is the focused band's own circle, so it has to sit in that band's
// place in the stack: above the bands under it, below the bands over it. That
// is the only way it can start out indistinguishable from the arc it grows out
// of.
//
// Which means the stack is per band, not per kind. Each band owns a decade —
// its fill, then its options, then its markings — and the focused band's circle
// takes the top of its own decade:
//
//   band k    k*10 + 1  fill
//             k*10 + 2  options
//             k*10 + 3  name and ruler
//             k*10 + 4  the circle, when this band is the one focused
//
// so a growing circle buries every band below it whole, exactly as it covers
// them. Hoisting all the options above all the fills — which is what this used
// to do — left a lower band's icons floating over a higher band's circle for as
// long as they took to fade.
//
// Bands *above* the focused one are the ones the circle can never reach, and
// they are what clears out of the way. The focused band's own markings sit out
// above everything (90) so its circle does not cut its name out from under it
// on the first frame, and its options sit above that (100) to fly to the ring.

/** Where the focused dial's own pieces go, clear of every band's decade. */
const Z_FOCUSED_MARKS = 90;
const Z_CHROME = 95;
const Z_FOCUSED_ITEMS = 100;

/** One band's fill. */
const BandArc = memo(
  ({
    band,
    color,
    height,
    focus,
    wash,
  }: {
    band: number;
    color: string;
    height: number;
    focus: SharedValue<number>;
    wash: SharedValue<number>;
  }) => {
    const style = useAnimatedStyle(() => {
      const dial = focus.value;
      return {
        opacity: dial >= 0 && band > dial ? 1 - wash.value : 1,
      };
    });
    return (
      <Animated.View
        style={[styles.layer, { zIndex: band * 10 + 1 }, style]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.arc,
            { top: arcTop(height, band), backgroundColor: color },
          ]}
        />
      </Animated.View>
    );
  },
);
BandArc.displayName = "BandArc";

/** A band's name and its ruler. Kept above the reveal, and taken away by
 *  fading, so opening a dial doesn't cut its own label out from under it. */
const BandMarks = memo(
  ({
    band,
    focused,
    caption,
    ink,
    height,
    marks,
  }: {
    band: number;
    /** The focused band's name rides above every decade; the others stay in
     *  their own, where a higher band's circle can bury them. */
    focused: boolean;
    caption: string;
    ink: string;
    height: number;
    marks: SharedValue<number>;
  }) => {
    const style = useAnimatedStyle(() => ({ opacity: 1 - marks.value }));
    return (
      <Animated.View
        style={[
          styles.layer,
          { zIndex: focused ? Z_FOCUSED_MARKS : band * 10 + 3 },
          style,
        ]}
        pointerEvents="none"
      >
        <Text
          style={[
            styles.bandCaption,
            { top: arcTop(height, band) + 17, color: ink },
          ]}
        >
          {caption.toUpperCase()}
        </Text>
        {TICKS.map((t) => (
          <View
            key={`${caption}${t.a}`}
            style={[
              styles.tick,
              {
                top: arcCenterY(height, band) - ITEM_R - 7,
                backgroundColor: ink,
                opacity: t.o,
                transform: [
                  { translateX: ITEM_R * Math.sin(t.a) },
                  { translateY: ITEM_R * (1 - Math.cos(t.a)) },
                  { rotate: `${t.a}rad` },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>
    );
  },
);
BandMarks.displayName = "BandMarks";

/** A band's options. The focused dial's ride above the reveal; the others are
 *  under nothing, so they leave the same way the marks do. */
const ItemGroup = memo(
  ({
    band,
    focused,
    focus,
    wash,
    children,
  }: {
    band: number;
    focused: boolean;
    focus: SharedValue<number>;
    wash: SharedValue<number>;
    children: React.ReactNode;
  }) => {
    const style = useAnimatedStyle(() => ({
      opacity: focus.value === band ? 1 : 1 - wash.value,
    }));
    return (
      <Animated.View
        style={[
          styles.layer,
          { zIndex: focused ? Z_FOCUSED_ITEMS : band * 10 + 2 },
          style,
        ]}
        pointerEvents="none"
      >
        {children}
      </Animated.View>
    );
  },
);
ItemGroup.displayName = "ItemGroup";

interface StepDeliveryProps {
  /** Told when a dial takes over the screen, so the wizard's footer can get
   *  out of the way — the focused state is a gesture, not a page. */
  onFocusChange: (focused: boolean) => void;
}

export default function StepDelivery({ onFocusChange }: StepDeliveryProps) {
  const { form, setAudienceIndex, setMood, setProfession } =
    usePresentationForm();

  const professionIndex = Math.max(
    0,
    PROFESSIONS.indexOf(form.profession ?? "other"),
  );
  const moodIndex = Math.max(
    0,
    MOOD_OPTIONS.findIndex((m) => m.tag === form.mood),
  );

  // Everything is placed from the step's own height, so nothing is drawn until
  // it has been measured.
  const [height, setHeight] = useState(0);
  // Which dial the focused chrome belongs to. Set once per gesture, and left
  // in place afterwards so it has something to draw while it collapses.
  const [focusId, setFocusId] = useState<number | null>(null);

  const h = useSharedValue(0);
  /** The dial being dragged, or -1. `focus` outlives the drag — it is what the
   *  collapse animates against — so a separate flag says whether a finger is
   *  actually down, which the end callback needs to tell a real release from a
   *  touch that was handed back to the navigator. */
  const focus = useSharedValue(-1);
  const dragging = useSharedValue(0);
  /** 0..1, how far the focused dial has arranged itself: the arc-to-ring
   *  layout, and the gesture's own sense of scale. */
  const expansion = useSharedValue(0);
  /** 0..1 for the circle itself. Runs ahead of `expansion` on the way in and
   *  behind it on the way out. */
  const circle = useSharedValue(0);
  /** 0..1 for everything the circle cannot cover leaving of its own accord. */
  const wash = useSharedValue(0);
  /** 0..1 for the band names and their rulers. Their own, because they are read
   *  while the circle grows and so have to leave at its pace, not the wash's. */
  const marks = useSharedValue(0);
  /** Centre the drag turns about, fixed for the length of one gesture. */
  const pivotY = useSharedValue(0);
  const prevX = useSharedValue(0);
  const prevY = useSharedValue(0);
  /** Whole-step position, for the detent tick. */
  const stepped = useSharedValue(0);
  /** Smoothed rate of change, so a flick carries a little past the finger. */
  const spin = useSharedValue(0);
  /** The settled selection of whichever dial is focused. The middle of the ring
   *  is drawn from this, so the active value snaps there and stays. */
  const snapped = useSharedValue(0);
  /** 0..1 for the focused dial's furniture, timed off the same constants as the
   *  circle but on its own schedule. */
  const chrome = useSharedValue(0);

  const raw0 = useSharedValue(professionIndex);
  const raw1 = useSharedValue(moodIndex);
  const raw2 = useSharedValue(form.audienceIndex);
  const raws = useMemo(() => [raw0, raw1, raw2], [raw0, raw1, raw2]);

  // `raw` runs past either end of its list, so the position it settles on is
  // brought back into range here — that is the whole of the wrap-around.
  const commit = useCallback(
    (dial: number, position: number) => {
      const index = wrapIndex(position, COUNTS[dial]);
      if (dial === 0) setProfession(PROFESSIONS[index]);
      else if (dial === 1) setMood(MOOD_OPTIONS[index].tag);
      else setAudienceIndex(index);
    },
    [setProfession, setMood, setAudienceIndex],
  );

  // The one bridge back to React, and the only place a selection is written.
  // It fires on a detent crossing, never per frame.
  useAnimatedReaction(
    () => Math.round(raw0.value),
    (v, p) => {
      if (p !== null && v !== p) scheduleOnRN(commit, 0, v);
    },
  );
  useAnimatedReaction(
    () => Math.round(raw1.value),
    (v, p) => {
      if (p !== null && v !== p) scheduleOnRN(commit, 1, v);
    },
  );
  useAnimatedReaction(
    () => Math.round(raw2.value),
    (v, p) => {
      if (p !== null && v !== p) scheduleOnRN(commit, 2, v);
    },
  );

  const open = useCallback(
    (dial: number) => {
      setFocusId(dial);
      onFocusChange(true);
    },
    [onFocusChange],
  );
  const close = useCallback(() => onFocusChange(false), [onFocusChange]);

  // Built once. Nothing in here closes over a value that changes, because a
  // gesture object swapped mid-drag loses its end callbacks — which would
  // leave the screen stuck in the focused state.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        // A tap must not open anything; the dial answers to an actual drag.
        .minDistance(8)
        // Anything the dials don't own is handed straight back: a drag over
        // the title, or one starting at the left edge, is the navigator's
        // back swipe, and this gesture must not swallow it.
        .onTouchesDown((e, manager) => {
          if (dragging.value === 1) return;
          const touch = e.allTouches[0];
          if (!touch) return;
          if (touch.x < EDGE_SLOP || pickBand(h.value, touch.x, touch.y) < 0) {
            manager.fail();
          }
        })
        .onStart((e) => {
          const measured = h.value;
          const dial = pickBand(measured, e.x, e.y);
          focus.value = dial;
          if (dial < 0) return;
          dragging.value = 1;

          prevX.value = e.x;
          prevY.value = e.y;
          spin.value = 0;
          stepped.value = Math.round(raws[dial].value);
          snapped.value = stepped.value;
          // The wheel's centre stays where the finger found it. Letting it
          // travel to the middle of the screen with the expansion would move
          // it past the finger, and the drag would reverse under the hand
          // halfway through.
          pivotY.value = Math.max(arcCenterY(measured, dial), e.y + 150);

          const time = TIMING[dial];
          circle.value = withTiming(1, {
            duration: time.circleIn,
            easing: EASE_IN,
          });
          marks.value = withTiming(1, {
            duration: time.marksIn,
            easing: EASE_IN,
          });
          wash.value = withTiming(1, {
            duration: time.washIn,
            easing: EASE_IN,
          });
          expansion.value = withTiming(1, {
            duration: time.settleIn,
            easing: EASE_IN,
          });
          chrome.value = withDelay(
            time.chromeInDelay,
            withTiming(1, { duration: time.chromeIn, easing: EASE_IN }),
          );
          weight.press();
          scheduleOnRN(open, dial);
        })
        .onUpdate((e) => {
          const dial = focus.value;
          if (dial < 0) return;

          const dx = e.x - prevX.value;
          const dy = e.y - prevY.value;
          prevX.value = e.x;
          prevY.value = e.y;

          // Two wheels, blended — not one wheel whose centre travels. A centre
          // on the move would pass under the finger partway through and
          // reverse the drag in the hand. Collapsed, the axle is far below the
          // phone, so the arc answers to a sideways swipe. Focused, the axle is
          // the middle of the ring, so a finger circling it keeps turning the
          // dial round and round, and only gives back what it takes when the
          // circle is reversed.
          const open = expansion.value;
          const vx = e.x - CX;
          const arcY = e.y - pivotY.value;
          const ringY = e.y - focusCenterY(h.value);
          // Floor the radius so the dial doesn't go wild if the finger ends up
          // on top of a centre of rotation.
          const arcR2 = Math.max(vx * vx + arcY * arcY, 8100);
          const ringR2 = Math.max(vx * vx + ringY * ringY, 8100);

          // The tangential part of the finger's movement, in radians. Positive
          // is clockwise, which is the direction the options are laid out in —
          // so the wheel turns with the hand.
          const turn =
            ((dx * -arcY + dy * vx) / arcR2) * (1 - open) +
            ((dx * -ringY + dy * vx) / ringR2) * open;

          const count = COUNTS[dial];
          const step = STEP_C + (ringStep(count) - STEP_C) * open;
          const delta = turn / step;

          spin.value = spin.value * 0.7 - delta * 0.3;
          // Never clamped: the dial keeps turning in both directions and the
          // list wraps under it, so a long one is always within one swipe.
          const next = raws[dial].value - delta;
          raws[dial].value = next;

          const detent = Math.round(next);
          if (detent !== stepped.value) {
            stepped.value = detent;
            snapped.value = withSpring(detent, SNAP);
            // Pulsar's presets are worklets, so the tick lands on the UI thread
            // with the crossing rather than a hop through JS a frame later.
            // The lightest rung there is: a fast spin crosses many detents a
            // second, and anything heavier turns into a continuous buzz.
            weight.tick();
          }
        })
        .onFinalize(() => {
          if (dragging.value === 0) return;
          dragging.value = 0;
          const dial = focus.value;

          const settled = Math.round(raws[dial].value + spin.value * 4);
          if (settled !== stepped.value) {
            stepped.value = settled;
            haptics.select();
          }
          snapped.value = withSpring(settled, SNAP);
          raws[dial].value = withSpring(settled, {
            damping: 20,
            stiffness: 190,
            mass: 0.7,
          });

          // The selection is already applied; releasing only puts the dial
          // back. Cleared on the way out rather than now, so the collapse has
          // something to animate — and only if a newer drag hasn't claimed it.
          const time = TIMING[dial];
          chrome.value = withTiming(0, {
            duration: time.chromeOut,
            easing: EASE_OUT,
          });
          expansion.value = withTiming(0, {
            duration: time.settleOut,
            easing: EASE_OUT,
          });
          // Held off, so the names are not back over a screen that is still
          // the dial's colour. `withTiming` has no delay of its own — it is a
          // wrapper, the same one the chrome uses on the way in.
          marks.value = withDelay(
            time.marksDelay,
            withTiming(0, { duration: time.marksOut, easing: EASE_OUT }),
          );
          wash.value = withTiming(0, {
            duration: time.washOut,
            easing: EASE_OUT,
          });
          circle.value = withTiming(
            0,
            { duration: time.circleOut, easing: EASE_OUT },
            (finished) => {
              if (finished && focus.value === dial) focus.value = -1;
            },
          );
          scheduleOnRN(close);
        }),
    [
      chrome,
      close,
      dragging,
      circle,
      expansion,
      focus,
      h,
      open,
      pivotY,
      prevX,
      prevY,
      raws,
      snapped,
      spin,
      stepped,
      marks,
      wash,
    ],
  );

  // The reveal is the band's own circle, grown.
  //
  // It starts as an exact copy of the arc the finger landed on — same centre
  // far below the phone, same radius — and swells from there until it covers
  // the screen, so the band's own curve is what rises and flattens out. Drawn
  // once at that size and scaled, so growing it costs a transform per frame
  // rather than a layout pass.
  //
  // It is opaque from the first frame — at rest it is the arc, pixel for pixel,
  // which is the whole point. What that costs is handled in the stack: see the
  // layer components above.
  const circleStyle = useAnimatedStyle(() => {
    const dial = focus.value;
    const band = dial < 0 ? 0 : dial;
    return {
      opacity: dial < 0 ? 0 : 1,
      backgroundColor: COLORS[band],
      transform: [
        { translateX: CX - ARC_R },
        { translateY: arcCenterY(height, band) - ARC_R },
        { scale: 1 + (CIRCLE_R / ARC_R - 1) * circle.value },
      ],
    };
  });

  // The face turns with the values rather than sitting still under them, so
  // the whole dial reads as one thing being spun. The pointer is deliberately
  // outside this — it is the fixed mark the values are read against.
  const faceStyle = useAnimatedStyle(() => {
    const dial = focus.value;
    const position =
      dial === 1 ? raw1.value : dial === 2 ? raw2.value : raw0.value;
    const count = COUNTS[dial < 0 ? 0 : dial];
    return {
      transform: [{ rotate: `${-position * ringStep(count)}rad` }],
    };
  });

  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = e.nativeEvent.layout.height;
      setHeight(next);
      h.value = next;
    },
    [h],
  );

  const dial = focusId === null ? null : DIALS[focusId];
  const current =
    focusId === null
      ? null
      : dial!.options[
          [professionIndex, moodIndex, form.audienceIndex][focusId]
        ];

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.header}>
        <Text style={styles.title}>Set the tone{"\n"}for your script</Text>
        <Text style={styles.subtitle}>
          Adjust your profile, mood and audience to get a script tailored for
          you.
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.field}>
          {height > 0 && (
            <>
              {/* Each band is a slice of a circle wider than the screen,
                  stacked so the one below covers the one above — which is what
                  draws the curve between them. */}
              {DIALS.map((d, k) => (
                <BandArc
                  key={d.caption}
                  band={k}
                  color={d.color}
                  height={height}
                  focus={focus}
                  wash={wash}
                />
              ))}

              {/* Sits in the focused band's own place in the stack, so at
                  rest it is that band's arc and nothing else. */}
              <Animated.View
                style={[
                  styles.circle,
                  { zIndex: (focusId ?? 0) * 10 + 4 },
                  circleStyle,
                ]}
                pointerEvents="none"
              />

              {DIALS.map((d, k) => (
                <BandMarks
                  key={`marks-${d.caption}`}
                  marks={marks}
                  band={k}
                  focused={focusId === k}
                  caption={d.caption}
                  ink={d.ink}
                  height={height}
                />
              ))}

              {dial && (
                <Animated.View
                  style={[styles.layer, styles.chrome, chromeStyle]}
                  pointerEvents="none"
                >
                  <View style={styles.chromeHead}>
                    <Text style={[styles.chromeCaption, { color: dial.ink }]}>
                      {dial.caption.toUpperCase()}
                    </Text>
                    <View style={styles.titleSlot}>
                      <Animated.Text
                        key={current!.label}
                        entering={FadeInRight.duration(220)}
                        exiting={FadeOutLeft.duration(150)}
                        numberOfLines={1}
                        style={[styles.chromeTitle, { color: dial.ink }]}
                      >
                        {current!.label}
                      </Animated.Text>
                    </View>
                    <View style={styles.blurbSlot}>
                      <Animated.Text
                        key={current!.blurb}
                        entering={FadeInRight.duration(260).delay(40)}
                        exiting={FadeOutLeft.duration(150)}
                        numberOfLines={1}
                        style={[styles.chromeBlurb, { color: dial.ink }]}
                      >
                        {current!.blurb}
                      </Animated.Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.puck,
                      { top: focusCenterY(height) - PUCK / 2 },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.layer,
                      { transformOrigin: [CX, focusCenterY(height), 0] },
                      faceStyle,
                    ]}
                  >
                    {FACE.map((a, i) => (
                      <View
                        key={i}
                        style={[
                          styles.faceTick,
                          {
                            top: focusCenterY(height) - FACE_R - 5,
                            backgroundColor: dial.ink,
                            transform: [
                              { translateX: FACE_R * Math.sin(a) },
                              { translateY: FACE_R * (1 - Math.cos(a)) },
                              { rotate: `${a}rad` },
                            ],
                          },
                        ]}
                      />
                    ))}
                  </Animated.View>
                  <View
                    style={[
                      styles.pointer,
                      { top: focusCenterY(height) - POINTER_R - 11 },
                    ]}
                  />
                </Animated.View>
              )}

              {/* Options ride above the reveal only for the dial being
                  dragged; the other two go with the marks. */}
              {DIALS.map((d, k) => (
                <ItemGroup
                  key={`items-${d.caption}`}
                  band={k}
                  focused={focusId === k}
                  focus={focus}
                  wash={wash}
                >
                  {d.options.map((option, i) => (
                    <DialItem
                      key={option.label}
                      option={option}
                      index={i}
                      dial={k}
                      count={d.options.length}
                      raw={raws[k]}
                      focus={focus}
                      expansion={expansion}
                      snapped={snapped}
                      height={height}
                      ink={d.ink}
                      glyph={d.glyph}
                    />
                  ))}
                </ItemGroup>
              ))}
            </>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: 6,
    paddingHorizontal: 30,
    alignItems: "center",
    gap: 9,
  },
  title: {
    fontSize: 30,
    lineHeight: 35,
    textAlign: "center",
    color: INK,
    fontFamily: fonts.alanSans.bold,
  },
  subtitle: {
    fontSize: 14.5,
    lineHeight: 20,
    textAlign: "center",
    color: SUBTLE,
    fontFamily: fonts.alanSans.regular,
  },
  // The drag surface, and the frame everything below is placed in. It covers
  // the header too — a drag up there simply finds no band.
  field: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  layer: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  arc: {
    position: "absolute",
    left: CX - ARC_R,
    width: ARC_R * 2,
    height: ARC_R * 2,
    borderRadius: ARC_R,
  },
  bandCaption: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10.5,
    letterSpacing: 2.4,
    fontFamily: fonts.krona,
  },
  tick: {
    position: "absolute",
    left: CX - 1,
    width: 2,
    height: 14,
    borderRadius: 1,
  },
  circle: {
    position: "absolute",
    left: 0,
    top: 0,
    width: ARC_R * 2,
    height: ARC_R * 2,
    borderRadius: ARC_R,
  },
  chrome: { zIndex: Z_CHROME },
  chromeHead: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 16,
    alignItems: "center",
  },
  chromeCaption: {
    fontSize: 10.5,
    letterSpacing: 2.6,
    opacity: 0.75,
    fontFamily: fonts.krona,
  },
  // Fixed slots: the label swap animates in and out on top of itself, so
  // nothing below it moves while the dial is being turned.
  titleSlot: { alignSelf: "stretch", height: 46, justifyContent: "center" },
  blurbSlot: { alignSelf: "stretch", height: 22, justifyContent: "center" },
  chromeTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 33,
    fontFamily: fonts.alanSans.bold,
  },
  chromeBlurb: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 14.5,
    opacity: 0.8,
    fontFamily: fonts.alanSans.regular,
  },
  puck: {
    position: "absolute",
    left: CX - PUCK / 2,
    width: PUCK,
    height: PUCK,
    borderRadius: PUCK / 2,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  faceTick: {
    position: "absolute",
    left: CX - 1,
    width: 2,
    height: 10,
    borderRadius: 1,
    opacity: 0.35,
  },
  pointer: {
    position: "absolute",
    left: CX - 2.5,
    width: 5,
    height: 22,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
});
