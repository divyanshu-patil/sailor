import { Canvas, Text } from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { FontSet, layoutText, Segment } from "../text-layout";
import { RevealMode, REVEAL } from "../config";
import { DistortReveal } from "./distort-reveal";

export interface WrappedTextProps {
  /** One or more source lines, each an array of styled segments. */
  lines: Segment[][];
  fonts: FontSet;
  fontSize: number;
  lineHeightMultiplier: number;
  color: string;
  boldColor?: string;
  justify?: boolean;
  spacing?: number;
  /**
   * Width available to the block. Measured once by the parent rather than per
   * block: every block is the same width, and an onLayout round trip each
   * meant a second render pass per canvas.
   */
  width: number;
  contentWidthOffset?: number;
  style?: StyleProp<ViewStyle>;
  reveal: RevealMode;
  /** Position within the first chunk — staggers the distort sweeps. */
  revealIndex: number;
  /** Accent colour the distort wavefront pulls toward. */
  tint: string;
}

export const WrappedText = React.memo(
  ({
    lines,
    fonts,
    fontSize,
    lineHeightMultiplier,
    color,
    boldColor,
    justify = false,
    spacing = 0,
    width,
    contentWidthOffset = 0,
    style,
    reveal,
    revealIndex,
    tint,
  }: WrappedTextProps) => {
    const lineHeight = fontSize * lineHeightMultiplier;
    const contentWidth = Math.max(width - contentWidthOffset, 0);
    const resolvedBoldColor = boldColor ?? color;

    const { words, height } = useMemo(() => {
      if (!contentWidth) return { words: [], height: lineHeight };
      return layoutText(
        lines,
        fonts,
        contentWidth,
        lineHeight,
        justify,
        fontSize,
      );
    }, [lines, fonts, contentWidth, lineHeight, justify, fontSize]);

    const glyphs = useMemo(
      () =>
        words.map((word, i) => (
          <Text
            key={i}
            x={word.x}
            y={word.y}
            text={word.text}
            font={word.font}
            color={word.bold ? resolvedBoldColor : color}
          />
        )),
      [words, color, resolvedBoldColor],
    );

    if (contentWidth <= 0) return null;

    return (
      <Animated.View
        entering={
          reveal === "fade"
            ? FadeIn.duration(REVEAL.fadeDurationMs)
            : undefined
        }
        style={[{ marginBottom: spacing }, style]}
      >
        <Canvas style={{ width: contentWidth, height }}>
          {reveal === "distort" ? (
            <DistortReveal
              width={contentWidth}
              height={height}
              tint={tint}
              delayMs={revealIndex * REVEAL.distortStaggerMs}
            >
              {glyphs}
            </DistortReveal>
          ) : (
            glyphs
          )}
        </Canvas>
      </Animated.View>
    );
  },
);

WrappedText.displayName = "WrappedText";
