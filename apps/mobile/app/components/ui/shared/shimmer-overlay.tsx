// components/ui/ShimmerOverlay.tsx
import React, { useEffect } from "react";
import { StyleSheet, View, LayoutChangeEvent } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface ShimmerOverlayProps {
  children: React.ReactNode;
  /** Base color of the content when the sheen isn't passing over it */
  baseColor: string;
  /** Bright highlight color of the sweeping sheen */
  highlightColor?: string;
  /** How long one sweep takes, ms */
  duration?: number;
}

/**
 * Wraps arbitrary content (text, icons, or both) and continuously
 * sweeps a gradient highlight across it, masked to the content's
 * own shape. Purely visual — content underneath renders normally,
 * this only adds the moving sheen on top.
 */
const ShimmerOverlay = ({
  children,
  baseColor,
  highlightColor = "#FFFFFF",
  duration = 2200,
}: ShimmerOverlayProps) => {
  const width = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    // Restart the loop whenever measured width changes (e.g. text/font load)
    translateX.value = -1;
    translateX.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [duration, translateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  // Gradient band is 2x content width so it can fully enter/exit
  const animatedGradientStyle = useAnimatedStyle(() => {
    const bandWidth = width.value * 2;
    return {
      width: bandWidth,
      transform: [
        {
          translateX: translateX.value * bandWidth - bandWidth / 2,
        },
        { rotate: "20deg" },
      ],
    };
  });

  return (
    <MaskedView
      onLayout={onLayout}
      maskElement={<View style={styles.maskWrap}>{children}</View>}
    >
      {/* Base layer: solid color fill so masked content has its
          resting color when the sheen isn't over it */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />
      <Animated.View style={[StyleSheet.absoluteFill, animatedGradientStyle]}>
        <LinearGradient
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          colors={[baseColor, baseColor, highlightColor, baseColor, baseColor]}
          locations={[0, 0.35, 0.5, 0.65, 1]}
        />
      </Animated.View>
      {/* Invisible spacer so MaskedView sizes itself to content */}
      <View style={styles.hiddenSpacer}>{children}</View>
    </MaskedView>
  );
};

export default ShimmerOverlay;

const styles = StyleSheet.create({
  maskWrap: {
    // MaskedView needs the mask element's own layout, not absolute
  },
  hiddenSpacer: {
    opacity: 0,
  },
});
