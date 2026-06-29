import {
  Dimensions,
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

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
    return {
      transform: [
        { translateX: x },
        { translateY: prevDrag.translateY.value },
        { rotate: `${progress * MAX_ROTATION}deg` },
      ],
      opacity: prevDrag.opacity.value,
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

    const translateX = currIndex === 0 && progress >= 0 ? x : 0;
    const translateY = currIndex === 0 && progress >= 0 ? arcY : 0;
    const rotate =
      currIndex === 0 && progress >= 0
        ? progress * MAX_ROTATION
        : stackRotation;
    return {
      transform: [{ translateX }, { translateY }, { rotate: `${rotate}deg` }],
      zIndex: numOfCards - currIndex,
    };
  });

  const zIndex = currIndex === -1 ? numOfCards + 1 : numOfCards - currIndex;
  const animatedStyle =
    currIndex === -1 ? prevAnimatedStyle : normalAnimatedStyle;

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: color }, animatedStyle]}
    >
      <Text>{text}</Text>
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
    },
  });
};
