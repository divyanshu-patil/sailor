/* eslint-disable react-hooks/immutability */
import React, { useMemo, useEffect } from "react";
import { View, Dimensions } from "react-native";
import {
  Canvas,
  Text as SkiaText,
  Blur,
  Group,
  matchFont,
} from "@shopify/react-native-skia";
import Animated, {
  useSharedValue,
  useDerivedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { fonts } from "@/constants/fonts";
import { SpringConfig } from "react-native-reanimated/lib/typescript/animation/spring";

type TextMorphProps = {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
  maxWidth?: number;
  maxLines?: number;
};

interface TAnimationConfig {
  spring: SpringConfig;
  duration: {
    mountFade: number;
    morph: number;
    exit: number;
  };
  blur: {
    morphPeak: number;
    exitPeak: number;
  };
  translate: {
    mountFrom: number;
    mountFromX: number;
    exitTo: number;
  };
  morphBlurCurve: {
    input: [number, number, number];
  };
  caseChange: {
    duration: number;
  };
}

export const ANIMATION_CONFIG: TAnimationConfig = {
  spring: {
    damping: 120,
  },
  duration: {
    mountFade: 220, // ms — opacity fade-in on first render
    morph: 280, // ms — blur progress curve while a char springs to a new spot
    exit: 180, // ms — exit fade / translate / blur, all run over this span
  },
  blur: {
    morphPeak: 3, // max blur sigma reached mid-transition when repositioning
    exitPeak: 4, // blur sigma a character reaches as it exits
  },
  translate: {
    mountFrom: 6, // px — characters rise up from this Y offset on mount
    mountFromX: -20, // px — characters slide in from this X offset on mount
    exitTo: 8, // px — characters fall to this Y offset on exit
  },
  morphBlurCurve: {
    input: [0, 0.3, 1],
  },
  caseChange: {
    duration: 130, // ms — each half (fade-out / fade-in) of an upper<->lower swap
  },
};

const SPACE_WIDTH_FALLBACK_RATIO = 0.28;

type CharEntry = {
  id: string;
  label: string;
  x: number;
  row: number;
  width: number;
  exiting: boolean;
};

function layoutCharacters(
  text: string,
  font: any,
  maxWidth: number,
): CharEntry[] {
  // A non-string took the whole screen down mid-render: an API error object
  // reached `text`, and `text.split` isn't a function. Everything here is
  // user-facing copy, so rendering nothing is the right worst case.
  if (typeof text !== "string") return [];

  const counts: Record<string, number> = {};
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);

  const entries: CharEntry[] = [];
  let cursorX = 0;
  let row = 0;

  for (const token of tokens) {
    const isWhitespace = /^\s+$/.test(token);

    // measure whole token width up front to decide wrapping at word boundaries
    let tokenWidth = 0;
    for (const ch of token) {
      const w = font.measureText(ch).width;
      tokenWidth += w > 0 ? w : font.getSize() * SPACE_WIDTH_FALLBACK_RATIO;
    }

    const shouldWrap =
      !isWhitespace && cursorX > 0 && cursorX + tokenWidth > maxWidth;

    if (shouldWrap) {
      cursorX = 0;
      row += 1;
    }

    for (const char of token) {
      const k = char.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
      const id = `${k}-${counts[k]}`;

      let charWidth = font.measureText(char).width;
      if (charWidth === 0) {
        // Bare whitespace (and some punctuation on certain typefaces) can
        // measure to 0 — fall back to a reasonable estimate so the cursor
        // still advances and words don't run together.
        charWidth = font.getSize() * SPACE_WIDTH_FALLBACK_RATIO;
      }

      // don't render/advance for whitespace sitting at the very start of a line
      const skipLeadingSpace = isWhitespace && cursorX === 0;
      if (!skipLeadingSpace) {
        entries.push({
          id,
          label: char,
          x: cursorX,
          row,
          width: charWidth,
          exiting: false,
        });
        cursorX += charWidth;
      }
    }
  }

  return entries;
}

function MorphChar({
  entry,
  font,
  color,
  lineHeight,
  baselineOffset,
  onExitComplete,
}: {
  entry: CharEntry;
  font: any;
  color: string;
  lineHeight: number;
  baselineOffset: number;
  onExitComplete?: (id: string) => void;
}) {
  const x = useSharedValue(entry.x);
  const targetY = baselineOffset + entry.row * lineHeight;
  const y = useSharedValue(targetY);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue<number>(
    ANIMATION_CONFIG.translate.mountFrom,
  );
  const translateX = useSharedValue<number>(
    ANIMATION_CONFIG.translate.mountFromX,
  );
  const progress = useSharedValue(0); // 0 -> 1 across a position transition
  const exitBlur = useSharedValue(0);
  const isFirstRender = useSharedValue(true);
  const exiting = entry.exiting;

  // separate opacity layer just for upper<->lower case glyph swaps
  const caseFadeOpacity = useSharedValue(1);
  const [displayLabel, setDisplayLabel] = React.useState(entry.label);
  const prevLabelRef = React.useRef(entry.label);

  // Read through a ref so a new `onExitComplete` identity from the parent
  // can't re-run — and therefore restart — the exit animation below.
  const onExitCompleteRef = React.useRef(onExitComplete);
  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  });

  useEffect(() => {
    if (exiting) return; // handled in the exit effect below

    if (isFirstRender.value) {
      // mount: fade + rise up + slide in from the left, no blur pulse
      isFirstRender.value = false;
      opacity.value = withTiming(1, {
        duration: ANIMATION_CONFIG.duration.mountFade,
      });
      translateY.value = withSpring(0, ANIMATION_CONFIG.spring);
      translateX.value = withSpring(0, ANIMATION_CONFIG.spring);
      x.value = entry.x;
      y.value = targetY;
      progress.value = 0;
    } else {
      // position changed: spring across, blur pulses 0 -> peak -> 0 alongside it
      x.value = withSpring(entry.x, ANIMATION_CONFIG.spring);
      y.value = withSpring(targetY, ANIMATION_CONFIG.spring);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: ANIMATION_CONFIG.duration.morph,
      });
      // A character that was on its way out and is wanted again — the text
      // changed a second time inside the 180ms exit — keeps its component
      // (same key), so nothing else would undo the exit: it stayed at
      // whatever opacity the fade-out had reached, usually 0. That was the
      // missing letters. For a character that never left, these are no-ops.
      opacity.value = withTiming(1, {
        duration: ANIMATION_CONFIG.duration.mountFade,
      });
      translateY.value = withSpring(0, ANIMATION_CONFIG.spring);
      exitBlur.value = 0;
    }
  }, [
    entry.x,
    targetY,
    exiting,
    isFirstRender,
    opacity,
    translateY,
    translateX,
    x,
    y,
    progress,
    exitBlur,
  ]);

  useEffect(() => {
    if (!exiting) return;
    // exit: fade out, translate down, blur out — then remove from state.
    //
    // The removal is timed on the JS side instead of being fired from the
    // withTiming callback. `scheduleOnRN` serialises its target into the
    // worklet runtime on every run, and there is one of these per character:
    // when the status line swapped out, the whole string exited at once and
    // each completion re-rendered the parent, which re-armed every other
    // character's callback. That burst is what aborted the JS thread inside
    // the worklets runtime. A timer matching the animation duration removes
    // the worklet -> JS hop entirely and looks identical on screen.
    opacity.value = withTiming(0, { duration: ANIMATION_CONFIG.duration.exit });
    translateY.value = withTiming(ANIMATION_CONFIG.translate.exitTo, {
      duration: ANIMATION_CONFIG.duration.exit,
    });
    exitBlur.value = withTiming(ANIMATION_CONFIG.blur.exitPeak, {
      duration: ANIMATION_CONFIG.duration.exit,
    });

    const timeout = setTimeout(() => {
      onExitCompleteRef.current?.(entry.id);
    }, ANIMATION_CONFIG.duration.exit);

    return () => clearTimeout(timeout);
  }, [entry.id, exitBlur, exiting, opacity, translateY]);

  // same character identity (id is keyed on lowercase letter), but the glyph
  // itself changed case — e.g. "a" -> "A". Cross-fade the label instead of
  // just swapping it instantly.
  useEffect(() => {
    if (exiting) return;
    if (entry.label === prevLabelRef.current) return;

    const prevLabel = prevLabelRef.current;
    const nextLabel = entry.label;
    prevLabelRef.current = nextLabel;

    const isCaseSwap =
      prevLabel.toLowerCase() === nextLabel.toLowerCase() &&
      prevLabel !== nextLabel;

    if (isCaseSwap) {
      // Same JS-timer treatment as the exit above — no worklet -> JS hop.
      caseFadeOpacity.value = withTiming(0, {
        duration: ANIMATION_CONFIG.caseChange.duration,
      });

      let landed = false;
      const timeout = setTimeout(() => {
        landed = true;
        setDisplayLabel(nextLabel);
        caseFadeOpacity.value = withTiming(1, {
          duration: ANIMATION_CONFIG.caseChange.duration,
        });
      }, ANIMATION_CONFIG.caseChange.duration);

      return () => {
        clearTimeout(timeout);
        // Interrupted halfway (the text moved on, or the letter started
        // leaving): land the new glyph now instead of leaving it faded out.
        if (!landed) {
          setDisplayLabel(nextLabel);
          caseFadeOpacity.value = 1;
        }
      };
    }

    setDisplayLabel(nextLabel);
  }, [entry.label, exiting, caseFadeOpacity]);

  const animatedX = useDerivedValue(() => x.value + translateX.value);
  const animatedY = useDerivedValue(() => y.value + translateY.value);
  const animatedOpacity = useDerivedValue(() => opacity.value);

  const blurSigma = useDerivedValue(() => {
    if (exiting) return exitBlur.value;
    return interpolate(
      progress.value,
      ANIMATION_CONFIG.morphBlurCurve.input,
      [0, ANIMATION_CONFIG.blur.morphPeak, 0],
      Extrapolation.CLAMP,
    );
  });

  return (
    <Group opacity={animatedOpacity} layer>
      <Blur blur={blurSigma} />
      <Group opacity={caseFadeOpacity}>
        <SkiaText
          x={animatedX}
          y={animatedY}
          text={displayLabel}
          font={font}
          color={color}
        />
      </Group>
    </Group>
  );
}

export function TextMorph({
  text,
  fontSize = 32,
  color = "white",
  lineHeight,
  fontFamily = fonts.krona,
  maxWidth = Dimensions.get("window").width - 40,
  maxLines = 3,
}: TextMorphProps) {
  const [containerWidth, setContainerWidth] = React.useState(maxWidth ?? 0);

  const resolvedMaxWidth = maxWidth ?? containerWidth;

  const font = useMemo(
    () => matchFont({ fontSize, fontFamily }),
    [fontSize, fontFamily],
  );

  const resolvedLineHeight = lineHeight ?? fontSize * 1.3;
  const baselineOffset = resolvedLineHeight * 0.7;

  const targetCharacters = useMemo<CharEntry[]>(() => {
    if (!font || !resolvedMaxWidth) return [];
    return layoutCharacters(text, font, resolvedMaxWidth);
  }, [text, font, resolvedMaxWidth]);
  // displayedCharacters = target characters + any still-exiting ones held over,
  // each carrying its own `exiting` flag.
  //
  // Derived directly in the render body (React's recommended pattern for
  // "adjust state when a prop changes") instead of a useEffect, so there's
  // no extra commit/effect round trip and no "setState in an effect" warning.
  const [prevTargetCharacters, setPrevTargetCharacters] =
    React.useState(targetCharacters);
  const [displayedCharacters, setDisplayedCharacters] =
    React.useState<CharEntry[]>(targetCharacters);

  if (targetCharacters !== prevTargetCharacters) {
    const targetIds = new Set(targetCharacters.map((c) => c.id));
    const stillExiting = displayedCharacters.filter(
      (c) => c.exiting && !targetIds.has(c.id),
    );
    const newlyRemoved = displayedCharacters
      .filter((c) => !c.exiting && !targetIds.has(c.id))
      .map((c) => ({ ...c, exiting: true }));

    setPrevTargetCharacters(targetCharacters);
    setDisplayedCharacters([
      ...targetCharacters,
      ...stillExiting,
      ...newlyRemoved,
    ]);
  }

  // Stable identity: MorphChar's exit effect must not re-run (and so restart
  // the exit animation) every time this component re-renders.
  const handleExitComplete = React.useCallback((id: string) => {
    setDisplayedCharacters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  if (!font) return <View style={{ height: resolvedLineHeight * maxLines }} />;

  const rowsUsed = displayedCharacters.length
    ? Math.max(...displayedCharacters.map((c) => c.row)) + 1
    : 1;
  const canvasHeight = Math.min(rowsUsed, maxLines) * resolvedLineHeight;

  return (
    <Animated.View
      style={{ width: "100%", alignSelf: "stretch" }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && w !== containerWidth) setContainerWidth(w);
      }}
    >
      {font && resolvedMaxWidth ? (
        <Canvas style={{ width: resolvedMaxWidth, height: canvasHeight }}>
          {displayedCharacters.map((c) => (
            <MorphChar
              key={c.id}
              entry={c}
              font={font}
              color={color}
              lineHeight={resolvedLineHeight}
              baselineOffset={baselineOffset}
              onExitComplete={handleExitComplete}
            />
          ))}
        </Canvas>
      ) : null}
    </Animated.View>
  );
}
