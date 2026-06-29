import {
  Dimensions,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  FadeInRight,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  ZoomIn,
} from "react-native-reanimated";
import { ScriptLine } from "../../script-text/ScriptLine";

export type Delivery =
  | "energetic"
  | "confident"
  | "explaining"
  | "curious"
  | "dramatic"
  | "gentle"
  | "pause"
  | "storytelling";

interface CardProps {
  text: string;
  reveal: string;
  color: string;
  impact: number;
  delivery: Delivery;
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
}

const ROTATION_STEP = -8;
const ROTATION_CYCLE = 3;
const MAX_DRAG = 250;
const ARC_HEIGHT = 50;
const MAX_ROTATION = 18;
const RETURN_START_X = Dimensions.get("window").width * 1.5;

const getRotation = (index: number) => {
  "worklet";
  return (index % ROTATION_CYCLE) * ROTATION_STEP;
};

const Card = ({
  text,
  color,
  currIndex,
  drag,
  prevDrag,
  numOfCards,
  introRotation,
  introScale,
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
    return {
      transform: [
        { translateX: x },
        { translateY: prevDrag.translateY.value },
        { rotate: `${progress * MAX_ROTATION + introOffset}deg` },
        { scale },
      ],
      opacity: 1,
      zIndex: numOfCards + 1,
    };
  });

  const normalAnimatedStyle = useAnimatedStyle(() => {
    const x = drag.translateX.value;
    const progress = interpolate(
      x,
      [-MAX_DRAG, 0, MAX_DRAG],
      [-1, 0, 1],
      Extrapolation.CLAMP,
    );
    const absProgress = Math.abs(progress);
    const arcY = absProgress * ARC_HEIGHT;

    const leftProgress = prevDrag
      ? interpolate(
          prevDrag.translateX.value,
          [0, RETURN_START_X],
          [1, 0],
          Extrapolation.CLAMP,
        )
      : 0;
    const cascadeProgress = progress >= 0 ? -progress : leftProgress;

    const virtualDepth = currIndex + cascadeProgress;
    const stackRotation = interpolate(
      virtualDepth,
      [0, 1, 2, 3],
      [getRotation(0), getRotation(1), getRotation(2), getRotation(3)],
      Extrapolation.CLAMP,
    );

    const introOffset = introRotation ? introRotation.value : 0;
    const scale = introScale ? introScale.value : 1;
    const translateX = currIndex === 0 && progress >= 0 ? x : 0;
    const translateY = currIndex === 0 && progress >= 0 ? arcY : 0;
    const rotate =
      (currIndex === 0 && progress >= 0
        ? progress * MAX_ROTATION
        : stackRotation) + introOffset;
    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotate}deg` },
        { scale },
      ],
      zIndex: numOfCards - currIndex,
    };
  });

  const animatedStyle =
    currIndex === -1 ? prevAnimatedStyle : normalAnimatedStyle;

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: color }, animatedStyle]}
    >
      <ScriptLine line={text} color={color} />
    </Animated.View>
  );
};

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
  });
};
