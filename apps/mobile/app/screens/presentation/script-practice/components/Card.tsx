import { Dimensions, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ScriptLine } from "../../script-text/ScriptLine";
import { getNormalCardTransform, MAX_ROTATION } from "../utils/cardMath";
import Lucide from "@react-native-vector-icons/lucide";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import React from "react";
// Delivery lives in @/types/presentation/card — it has to mirror the API's
// SpeakingStyle enum, and a second copy here is exactly what let the two drift
// apart (this one had "gentle", which the API has never sent, and was missing
// two dozen values it does). Re-exported so existing imports of it from this
// module keep working.
import type { DeliveryLike } from "@/types/presentation/card";
export type { Delivery, DeliveryLike } from "@/types/presentation/card";

interface CardProps {
  text: string;
  reveal: string;
  color: string;
  impact: number;
  delivery: DeliveryLike;
  numOfCards: number;
  currIndex: number;
  drag: {
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
    swipeDirection: SharedValue<"left" | "right" | null>;
  };
  prevDrag?: {
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
    opacity: SharedValue<number>;
  };
  introRotation?: SharedValue<number>;
  introScale?: SharedValue<number>;
  introOpacity?: SharedValue<number>;
}

const RETURN_START_X = Dimensions.get("window").width * 1.5;

const Card = React.memo(
  ({
    text,
    color,
    currIndex,
    drag,
    prevDrag,
    numOfCards,
    introRotation,
    introScale,
    introOpacity,
  }: CardProps) => {
    const styles = useStyles();

    const prevAnimatedStyle = useAnimatedStyle(() => {
      if (!prevDrag) return {};
      const x = prevDrag.translateX.value;
      const progress = interpolate(
        x,
        [0, RETURN_START_X],
        [0, 1],
        Extrapolation.CLAMP,
      );
      const introOffset = introRotation ? introRotation.value : 0;
      const scale = introScale ? introScale.value : 1;
      const opacity = introOpacity ? introOpacity.value : 1;
      return {
        transform: [
          { translateX: x },
          { translateY: prevDrag.translateY.value },
          { rotate: `${progress * MAX_ROTATION + introOffset}deg` },
          { scale },
        ],
        opacity,
        zIndex: numOfCards + 1,
      };
    });

    const normalAnimatedStyle = useAnimatedStyle(() => {
      const { translateX, translateY, rotate } = getNormalCardTransform({
        currIndex,
        dragTranslateX: drag.translateX.value,
        prevCardTranslateX: prevDrag?.translateX.value,
        returnStartX: RETURN_START_X,
      });

      const introOffset = introRotation ? introRotation.value : 0;
      const scale = introScale ? introScale.value : 1;
      const opacity = introOpacity ? introOpacity.value : 1;
      return {
        transform: [
          { translateX },
          { translateY },
          { rotate: `${rotate + introOffset}deg` },
          { scale },
        ],
        opacity,
        zIndex: numOfCards - currIndex,
      };
    });

    const animatedStyle =
      currIndex === -1 ? prevAnimatedStyle : normalAnimatedStyle;

    const pressed = useSharedValue(0);

    const pressedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: withTiming(pressed.value ? 0.97 : 1, { duration: 100 }) },
      ],
    }));

    return (
      <Animated.View
        style={[styles.card, { backgroundColor: color }, animatedStyle]}
      >
        <ScriptLine line={text} color={color} />
        <AnimatedPressable
          style={[styles.editButton, pressedStyle]}
          onPressIn={() => (pressed.value = 1)}
          onPressOut={() => (pressed.value = 0)}
        >
          <Lucide name="pen-line" size={32} color={"white"} />
        </AnimatedPressable>
      </Animated.View>
    );
  },
);

Card.displayName = "Card";

export default Card;

const useStyles = () => {
  const { width } = useWindowDimensions();
  const CARD_WIDTH = width - 48 * 2;
  return StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      position: "absolute",
      aspectRatio: 0.75,
      borderRadius: 77,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    editButton: {
      backgroundColor: "#414141",
      padding: 20,
      borderRadius: 24,
      position: "absolute",
      bottom: 30,
      right: 30,
    },
  });
};
