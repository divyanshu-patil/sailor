/* eslint-disable react-hooks/immutability */
import { StyleSheet } from "react-native";
import React from "react";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { deliveryModifier, RETURN_START_X, SCREEN_WIDTH } from "../constants";
import { Host, Text } from "@expo/ui/swift-ui";
import { useBackgroundColorStyle } from "../hooks/useBackgroundColorStyle";
import { lightenColor } from "../utils/lightenColor";

interface DeliveryPillProps {
  currentIndex: number;
  totalCards: number;
  delivery: string;
  isExhausted: boolean;
  translateX: SharedValue<number>;
  prevCardX: SharedValue<number>;
  prevCardOpacity: SharedValue<number>;
  swipeDirection: SharedValue<"left" | "right" | null>;
  isRetreating: SharedValue<boolean>;
  cardsCurrentColor: string;
  cardsPrevColor: string;
  cardsNextColor: string;
  color: string;
}

const DeliveryPill = ({
  currentIndex,
  totalCards,
  delivery,
  isExhausted,
  isRetreating,
  prevCardOpacity,
  prevCardX,
  swipeDirection,
  translateX,
  color,
  cardsCurrentColor,
  cardsNextColor,
  cardsPrevColor,
}: DeliveryPillProps) => {
  const pressed = useSharedValue(0);

  const animatedPillOpacityStyle = useAnimatedStyle(() => {
    if (isExhausted && prevCardX.value >= RETURN_START_X) return { opacity: 0 };

    if (currentIndex < totalCards - 1) return { opacity: 1 };

    if (isExhausted) {
      return {
        opacity: interpolate(
          prevCardX.value,
          [RETURN_START_X, RETURN_START_X * 0.6],
          [0, 1],
          Extrapolation.CLAMP,
        ),
      };
    }

    return {
      opacity: interpolate(
        translateX.value,
        [0, SCREEN_WIDTH * 0.4],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });
  const pillCurrentColor = isExhausted
    ? lightenColor(color)
    : lightenColor(cardsCurrentColor, 0.1);

  const pillNextColor =
    !isExhausted && currentIndex + 1 < totalCards
      ? lightenColor(cardsNextColor, 0.1)
      : lightenColor(color);

  const pillPrevColor =
    currentIndex - 1 >= 0 && currentIndex - 1 < totalCards
      ? lightenColor(cardsPrevColor, 0.1)
      : pillCurrentColor;

  const animatedPillColorStyle = useBackgroundColorStyle({
    translateX,
    prevCardX,
    prevCardOpacity,
    swipeDirection,
    isRetreating,
    currentColor: pillCurrentColor,
    nextColor: pillNextColor,
    prevColor: pillPrevColor,
  });

  const pillPressedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(interpolate(pressed.value, [0, 1], [1, 1.1]), {
            damping: 50,
          }),
        },
      ],
    };
  });

  return (
    <AnimatedPressable
      onPressIn={() => (pressed.value = withTiming(1))}
      onPressOut={() => (pressed.value = withTiming(0))}
      style={[
        styles.deliveryPill,
        animatedPillColorStyle,
        animatedPillOpacityStyle,
        pillPressedStyle,
      ]}
    >
      <Host matchContents>
        <Text modifiers={deliveryModifier(currentIndex)}>{delivery}</Text>
      </Host>
    </AnimatedPressable>
  );
};

export default DeliveryPill;

const styles = StyleSheet.create({
  deliveryPill: {
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
