import { Dimensions, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { ScriptLine } from "../../script-text/ScriptLine";
import { getNormalCardTransform, MAX_ROTATION } from "../utils/cardMath";

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

const RETURN_START_X = Dimensions.get("window").width * 1.5;

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
    const { translateX, translateY, rotate } = getNormalCardTransform({
      currIndex,
      dragTranslateX: drag.translateX.value,
      prevCardTranslateX: prevDrag?.translateX.value,
      returnStartX: RETURN_START_X,
    });

    const introOffset = introRotation ? introRotation.value : 0;
    const scale = introScale ? introScale.value : 1;

    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotate + introOffset}deg` },
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
