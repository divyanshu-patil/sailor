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
  /** Stacking order, from React's view of the deck. It is safe for this to lag
   *  the UI thread by a frame: a card that has left is off-screen, and the
   *  cards still on screen keep the same relative order either way. */
  zIndex: number;
  /** This card's absolute position in the deck. */
  index: number;
  /** The deck's current position, on the UI thread. Depth is derived from it
   *  inside the worklet rather than from React state so that advancing the
   *  deck and resetting the drag are seen as one atomic change. */
  currentIndexSV: SharedValue<number>;
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
    index,
    currentIndexSV,
    drag,
    prevDrag,
    zIndex,
    introRotation,
    introScale,
    introOpacity,
  }: CardProps) => {
    const styles = useStyles();

    // One style for both roles (stacked card / swiped-away card). Which role
    // this card plays is decided from `currentIndexSV` on the UI thread, so the
    // role and the drag values it reads always come from the same frame — a
    // React re-render can never pair a new depth with a stale drag offset.
    const animatedStyle = useAnimatedStyle(() => {
      const depth = index - currentIndexSV.value;
      const introOffset = introRotation ? introRotation.value : 0;
      const scale = introScale ? introScale.value : 1;
      let opacity = introOpacity ? introOpacity.value : 1;

      let translateX: number;
      let translateY: number;
      let rotate: number;

      if (depth < 0) {
        // Swiped away. The card one step back rides the "previous card" values
        // so a left swipe can pull it home; anything further back stays parked
        // off-screen (it can only be seen for the frame before React unmounts
        // it, and only when two swipes land inside one render).
        const isPrev = depth === -1 && prevDrag !== undefined;
        translateX = isPrev ? prevDrag!.translateX.value : RETURN_START_X;
        translateY = isPrev ? prevDrag!.translateY.value : 0;
        const progress = interpolate(
          translateX,
          [0, RETURN_START_X],
          [0, 1],
          Extrapolation.CLAMP,
        );
        rotate = progress * MAX_ROTATION;
        if (!isPrev) opacity = 0;
      } else {
        const transform = getNormalCardTransform({
          currIndex: depth,
          dragTranslateX: drag.translateX.value,
          prevCardTranslateX: prevDrag?.translateX.value,
          returnStartX: RETURN_START_X,
        });
        translateX = transform.translateX;
        translateY = transform.translateY;
        rotate = transform.rotate;
      }

      return {
        transform: [
          { translateX },
          { translateY },
          { rotate: `${rotate + introOffset}deg` },
          { scale },
        ],
        opacity,
      };
    });

    const pressed = useSharedValue(0);

    const pressedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: withTiming(pressed.value ? 0.97 : 1, { duration: 100 }) },
      ],
    }));

    return (
      <Animated.View
        style={[styles.card, { backgroundColor: color, zIndex }, animatedStyle]}
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
