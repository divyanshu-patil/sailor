import React, { useMemo } from "react";
import { StyleProp, Text, TextStyle, ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { fonts } from "@/constants/fonts";
import { Segment } from "../text-layout";
import { REVEAL } from "../config";

/**
 * Version 2's stand-in for the Skia `WrappedText` — a thin wrapper around a
 * plain <Text> that reproduces the same typography, so swapping the variant in
 * config.ts changes how the script is drawn but not how it reads.
 *
 * The families map onto the weights the Skia renderer asked `matchFont` for:
 * regular, and 600 for bold. RN needs the exact registered family name for a
 * custom font rather than fontWeight, so they're spelled out here.
 */
const FAMILY = {
  regular: fonts.newsreader.regular,
  bold: fonts.newsreader.semiBold,
  italic: fonts.newsreader.italic,
  boldItalic: fonts.newsreader.semiBoldItalic,
};

function familyFor(segment: Segment): string {
  if (segment.bold && segment.italic) return FAMILY.boldItalic;
  if (segment.bold) return FAMILY.bold;
  if (segment.italic) return FAMILY.italic;
  return FAMILY.regular;
}

export interface NativeTextProps {
  /** One or more source lines, each an array of styled segments. */
  lines: Segment[][];
  fontSize: number;
  lineHeightMultiplier: number;
  color: string;
  boldColor?: string;
  justify?: boolean;
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}

export const NativeText = React.memo(
  ({
    lines,
    fontSize,
    lineHeightMultiplier,
    color,
    boldColor,
    justify = false,
    spacing = 0,
    style,
  }: NativeTextProps) => {
    const resolvedBoldColor = boldColor ?? color;

    const textStyle = useMemo<TextStyle>(
      () => ({
        fontFamily: FAMILY.regular,
        fontSize,
        lineHeight: fontSize * lineHeightMultiplier,
        color,
        // iOS only, same as the Skia renderer's `justify` — Android lays the
        // text out left-aligned either way.
        textAlign: justify ? "justify" : "left",
      }),
      [fontSize, lineHeightMultiplier, color, justify],
    );

    return (
      <Animated.View
        entering={FadeIn.duration(REVEAL.fadeDurationMs)}
        style={[{ marginBottom: spacing }, style]}
      >
        <Text style={textStyle} allowFontScaling={false}>
          {lines.map((segments, lineIndex) => (
            <Text key={lineIndex}>
              {segments.map((segment, segmentIndex) => (
                <Text
                  key={segmentIndex}
                  style={
                    segment.bold || segment.italic
                      ? {
                          fontFamily: familyFor(segment),
                          color: segment.bold ? resolvedBoldColor : color,
                        }
                      : undefined
                  }
                >
                  {/* Collapse runs of whitespace the way the Skia layout does,
                      so both variants break lines at the same places. */}
                  {segment.text.replace(/\s+/g, " ")}
                </Text>
              ))}
              {lineIndex < lines.length - 1 ? "\n" : null}
            </Text>
          ))}
        </Text>
      </Animated.View>
    );
  },
);

NativeText.displayName = "NativeText";
