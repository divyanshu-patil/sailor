import { StyleSheet } from "react-native";
import React from "react";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import {
  Extrapolation,
  interpolate,
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { deliveryModifier, RETURN_START_X, SCREEN_WIDTH } from "../constants";
import { Host, Text } from "@expo/ui/swift-ui";
import { useBackgroundColorStyle } from "../hooks/useBackgroundColorStyle";

interface DeliveryPillProps {
  currentIndex: number;
  totalCards: number;
  delivery: string;
  currentIndexSV: SharedValue<number>;
  translateX: SharedValue<number>;
  prevCardX: SharedValue<number>;
  prevCardOpacity: SharedValue<number>;
  swipeDirection: SharedValue<"left" | "right" | null>;
  isRetreating: SharedValue<boolean>;
  /** One pill colour per card, in deck order. */
  colors: string[];
  fallbackColor: string;
}

const DeliveryPill = React.memo(
  ({
    currentIndex,
    totalCards,
    delivery,
    currentIndexSV,
    isRetreating,
    prevCardOpacity,
    prevCardX,
    swipeDirection,
    translateX,
    colors,
    fallbackColor,
  }: DeliveryPillProps) => {
    const pressed = useSharedValue(0);

    // Reads the deck position from the shared value, like the colour style
    // below, so the pill fades on the same frame the card it belongs to leaves.
    const animatedPillOpacityStyle = useAnimatedStyle(() => {
      const index = currentIndexSV.value;
      const isExhausted = index >= totalCards;

      if (isExhausted && prevCardX.value >= RETURN_START_X)
        return { opacity: 0 };

      if (index < totalCards - 1) return { opacity: 1 };

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

    const animatedPillColorStyle = useBackgroundColorStyle({
      translateX,
      prevCardX,
      prevCardOpacity,
      swipeDirection,
      isRetreating,
      currentIndexSV,
      colors,
      fallbackColor,
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
        layout={LinearTransition.springify()}
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
  },
);

DeliveryPill.displayName = "DeliveryPill";

export default DeliveryPill;

const styles = StyleSheet.create({
  deliveryPill: {
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
