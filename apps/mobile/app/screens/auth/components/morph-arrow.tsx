import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

export interface MorphArrowProps {
  progress: SharedValue<number>;
  /** Onboarding position (device points). */
  from: { left: number; top: number };
  /** Create-account position (device points). */
  to: { left: number; top: number };
  baseRotation?: number;
  targetRotation?: number;
  /** Mirror the arrow horizontally. */
  flip?: boolean;
  /** Portion of the transition this arrow reacts to. */
  inputRange?: [number, number];
}

/**
 * A curved doodle arrow that travels from its onboarding position to its
 * create-account position as the screen morphs. Positions are in device points
 * (already multiplied by the screen scale by the caller), so both ends of the
 * animation are independently tunable exactly like `MorphNote`.
 */
export function MorphArrow({
  progress,
  from,
  to,
  baseRotation = 0,
  targetRotation = 0,
  flip = false,
  inputRange = [0.2, 0.72],
}: MorphArrowProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      inputRange,
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: (to.left - from.left) * p },
        { translateY: (to.top - from.top) * p },
        { rotate: `${baseRotation + (targetRotation - baseRotation) * p}deg` },
        { scaleX: flip ? -1 : 1 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: from.left,
          top: from.top,
          width: 40,
          height: 40,
        },
        animatedStyle,
      ]}
    >
      <Svg width={40} height={80} viewBox="0 0 80 125" fill="none">
        <Path
          d="
          M 11 43
          C 28 37, 44 39, 55 50
          C 68 63, 68 82, 63 103
          M 63 103
          L 52 91
          M 63 103
          L 75 92
        "
          stroke="#AEB0B0"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}
