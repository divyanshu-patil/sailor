import { Canvas, Text } from "@shopify/react-native-skia";
import React, { useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { FontSet, layoutText, Segment } from "./text-layout";
import Animated, { FadeInDown } from "react-native-reanimated";

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
  contentWidthOffset?: number;
  style?: StyleProp<ViewStyle>;
  index: number;
  delay?: number;
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
    contentWidthOffset = 0,
    style,
    index,
    delay = 50,
  }: WrappedTextProps) => {
    const [width, setWidth] = useState(0);
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

    const onLayout = useCallback((e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setWidth((prev) => (prev !== w ? w : prev));
    }, []);

    return (
      <Animated.View
        entering={FadeInDown.springify()
          .damping(100)
          .delay(index * delay)}
        onLayout={onLayout}
        style={[{ marginBottom: spacing }, style]}
      >
        {contentWidth > 0 && (
          <Canvas style={{ width: contentWidth, height }}>
            {words.map((word, index) => (
              <Text
                key={index}
                x={word.x}
                y={word.y}
                text={word.text}
                font={word.font}
                color={word.bold ? resolvedBoldColor : color}
              />
            ))}
          </Canvas>
        )}
      </Animated.View>
    );
  },
);

WrappedText.displayName = "WrappedText";
