import React, {
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import { StyleSheet, View, Dimensions, Platform } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  interpolateColor,
  runOnJS,
  SharedValue,
  interpolate,
  Extrapolation,
  WithSpringConfig,
} from "react-native-reanimated";
import RNSystemSounds, {
  AndroidSoundIDs,
  iOSSoundIDs,
} from "@dashdoc/react-native-system-sounds";

type TSoundId =
  | (typeof AndroidSoundIDs)[keyof typeof AndroidSoundIDs]
  | (typeof iOSSoundIDs)[keyof typeof iOSSoundIDs];

type SliderProps = {
  min?: number;
  max?: number;
  step?: number;
  initialValue?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;

  // Appearance
  minHeight?: number;
  maxHeight?: number;
  itemWidth?: number;
  itemGap?: number;
  activeColor?: string;
  inactiveColor?: string;

  // Behavior / feel
  sigma?: number; // bell curve spread for height falloff
  colorFadeDistance?: number; // how many item-widths the color fade spans
  decelerationRate?: number;
  trailingSpringConfig?: WithSpringConfig;

  // Sound
  playSound?: boolean;
  soundId?: TSoundId;
};

export type SliderRef = {
  setValue: (value: number) => void;
};

const DEFAULT_TRAILING_SPRING: WithSpringConfig = {
  damping: 22,
  stiffness: 120,
  mass: 0.7,
};

const Slider = forwardRef<SliderRef, SliderProps>(
  (
    {
      min = 0,
      max = 100,
      step = 1,
      initialValue = Math.round((min + max) / 2),
      onChange,
      onChangeEnd,

      minHeight = 10,
      maxHeight = 50,
      itemWidth = 3,
      itemGap = 8,
      activeColor = "#c11b5c",
      inactiveColor = "black",

      sigma = 7,
      colorFadeDistance = 0.5,
      decelerationRate = 0.995,
      trailingSpringConfig = DEFAULT_TRAILING_SPRING,

      playSound = true,
      soundId,
    },
    ref,
  ) => {
    const [sliderWidth, setSliderWidth] = useState(0);
    const itemSpacing = itemWidth + itemGap;

    const values = Array.from(
      { length: Math.floor((max - min) / step) + 1 },
      (_, i) => min + i * step,
    );

    const scrollX = useSharedValue(0);
    const velocityDirection = useSharedValue(0); // -1 back, 1 forward, 0 idle

    const listRef = React.useRef<Animated.FlatList<number>>(null);
    const sidePadding = sliderWidth / 2 - itemWidth / 2;

    const scrollToValue = useCallback(
      (value: number, animated = true) => {
        const index = values.indexOf(value);
        if (index === -1) return;
        listRef.current?.scrollToOffset({
          offset: index * itemSpacing,
          animated,
        });
      },
      [values, itemSpacing],
    );

    useImperativeHandle(ref, () => ({
      setValue: (value: number) => scrollToValue(value, true),
    }));

    React.useEffect(() => {
      requestAnimationFrame(() => scrollToValue(initialValue, false));
    }, []);

    const lastIndex = useSharedValue(Math.round((initialValue - min) / step));

    const resolvedSoundId = (soundId ??
      Platform.select({
        ios: iOSSoundIDs.KeyPressed2,
        android: AndroidSoundIDs.TONE_CDMA_ABBR_ALERT,
      }) ??
      1104) as TSoundId;

    const reportValue = useCallback(
      (offsetX: number, isFinal: boolean) => {
        const rawIndex = offsetX / itemSpacing;
        const clampedIndex = Math.max(
          0,
          Math.min(values.length - 1, Math.round(rawIndex)),
        );

        const value = values[clampedIndex];

        if (isFinal) {
          onChangeEnd?.(value);
        } else {
          onChange?.(value);

          if (playSound) {
            RNSystemSounds.play(resolvedSoundId);
          }
        }
      },
      [values, onChange, onChangeEnd, itemSpacing, playSound, resolvedSoundId],
    );

    const maxOffset = (values.length - 1) * itemSpacing;
    const scrollHandler = useAnimatedScrollHandler({
      onScroll: (event) => {
        const prevX = scrollX.value;
        const newX = Math.min(Math.max(event.contentOffset.x, 0), maxOffset);

        if (newX !== prevX) {
          velocityDirection.value = newX > prevX ? 1 : -1;
        }

        scrollX.value = newX;

        const index = Math.round(newX / itemSpacing);

        if (index !== lastIndex.value) {
          lastIndex.value = index;

          runOnJS(reportValue)(newX, false);
        }
      },

      onMomentumEnd: (event) => {
        velocityDirection.value = 0;
        runOnJS(reportValue)(event.contentOffset.x, true);
      },
    });

    const handleScrollEndDrag = useCallback(
      (event: any) => {
        reportValue(event.nativeEvent.contentOffset.x, true);
      },
      [reportValue],
    );

    return (
      <View
        onLayout={(e) => {
          setSliderWidth(e.nativeEvent.layout.width);
        }}
        style={[styles.container, { height: maxHeight }]}
      >
        <Animated.FlatList
          ref={listRef}
          contentContainerStyle={[
            styles.flatlist,
            { paddingHorizontal: sidePadding, gap: itemGap },
          ]}
          data={values}
          keyExtractor={(item) => String(item)}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={itemSpacing}
          decelerationRate={decelerationRate}
          onScroll={scrollHandler}
          onScrollEndDrag={handleScrollEndDrag}
          scrollEventThrottle={16}
          renderItem={({ index }) => (
            <SliderBar
              index={index}
              scrollX={scrollX}
              velocityDirection={velocityDirection}
              itemSpacing={itemSpacing}
              itemWidth={itemWidth}
              minHeight={minHeight}
              maxHeight={maxHeight}
              sigma={sigma}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              colorFadeDistance={colorFadeDistance}
              trailingSpringConfig={trailingSpringConfig}
            />
          )}
        />
      </View>
    );
  },
);

Slider.displayName = "AnimatedSlider";

function SliderBar({
  index,
  scrollX,
  velocityDirection,
  itemSpacing,
  itemWidth,
  minHeight,
  maxHeight,
  sigma,
  activeColor,
  inactiveColor,
  colorFadeDistance,
  trailingSpringConfig,
}: {
  index: number;
  scrollX: SharedValue<number>;
  velocityDirection: SharedValue<number>;
  itemSpacing: number;
  itemWidth: number;
  minHeight: number;
  maxHeight: number;
  sigma: number;
  activeColor: string;
  inactiveColor: string;
  colorFadeDistance: number;
  trailingSpringConfig: WithSpringConfig;
}) {
  // Tracks a per-bar "effective distance" that lags only when this bar
  // is on the trailing side of scroll direction. The anchor (scrollX)
  // itself is never lagged, so the peak stays pinned to true center.
  const laggedDistance = useSharedValue(0);

  useAnimatedReaction(
    () => {
      const itemCenter = index * itemSpacing;
      return (scrollX.value - itemCenter) / itemSpacing;
    },
    (distance) => {
      const direction = velocityDirection.value;

      // Trailing = bar sits on the side scroll is moving away from.
      // Forward (1): bars behind center (distance > 0) trail.
      // Backward (-1): bars ahead of center (distance < 0) trail.
      const isTrailing =
        direction === 1
          ? distance > 0
          : direction === -1
            ? distance < 0
            : false;

      if (isTrailing) {
        laggedDistance.value = withSpring(distance, trailingSpringConfig);
      } else {
        laggedDistance.value = distance; // leading/centered side: instant
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    const d = laggedDistance.value;

    const gaussian = Math.exp(-(d * d) / (2 * sigma * sigma));
    const height = minHeight + (maxHeight - minHeight) * gaussian;

    // Color uses the lagged distance too, so only the bar truly under the
    // center marker is fully active, and it fades out sharply (not the
    // wide bell curve used for height) as you scroll.
    const colorProgress = interpolate(
      Math.abs(d),
      [0, colorFadeDistance],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const backgroundColor = interpolateColor(
      colorProgress,
      [0, 1],
      [inactiveColor, activeColor],
    );

    return { height, backgroundColor };
  });

  return (
    <Animated.View
      style={[styles.sliderBar, { width: itemWidth }, animatedStyle]}
    />
  );
}

export default Slider;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sliderBar: {},
  flatlist: {
    alignItems: "flex-end",
  },
});
