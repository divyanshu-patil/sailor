import React, {
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
  useMemo,
} from "react";
import { StyleSheet, View, Platform } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  interpolateColor,
  SharedValue,
  interpolate,
  Extrapolation,
  WithSpringConfig,
} from "react-native-reanimated";
import RNSystemSounds, {
  AndroidSoundIDs,
  iOSSoundIDs,
} from "@dashdoc/react-native-system-sounds";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { scheduleOnRN } from "react-native-worklets";

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
  sigma?: number;
  colorFadeDistance?: number;
  decelerationRate?:
    | number
    | "normal"
    | "fast"
    | SharedValue<number | "normal" | "fast" | undefined>
    | undefined;
  trailingSpringConfig?: WithSpringConfig;

  // Sound
  playSound?: boolean;
  soundId?: TSoundId;

  // Debouncing
  debounceMs?: number;
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
      decelerationRate = "normal",
      trailingSpringConfig = DEFAULT_TRAILING_SPRING,

      playSound = true,
      soundId,

      debounceMs = 20,
    },
    ref,
  ) => {
    const [sliderWidth, setSliderWidth] = useState(0);
    const itemSpacing = itemWidth + itemGap;

    // FIX #6: memoize values array — was recreated on every render
    const values = useMemo(
      () =>
        Array.from(
          { length: Math.floor((max - min) / step) + 1 },
          (_, i) => min + i * step,
        ),
      [min, max, step],
    );

    const scrollX = useSharedValue(0);
    const velocityDirection = useSharedValue(0);

    const listRef = React.useRef<Animated.FlatList<number>>(null);
    const sidePadding = sliderWidth / 2 - itemWidth / 2;

    // FIX #5: memoize contentContainerStyle — sidePadding state change was
    // causing FlatList to re-render all items on every layout measurement
    const contentStyle = useMemo(
      () => [styles.flatlist, { paddingHorizontal: sidePadding, gap: itemGap }],
      [sidePadding, itemGap],
    );

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
    }, [initialValue, scrollToValue]);

    const lastIndex = useSharedValue(Math.round((initialValue - min) / step));

    const resolvedSoundId = (soundId ??
      Platform.select({
        ios: iOSSoundIDs.KeyPressed2,
        android: AndroidSoundIDs.TONE_CDMA_ABBR_ALERT,
      }) ??
      1104) as TSoundId;

    const debouncedOnChange = useDebouncedCallback((value: number) => {
      onChange?.(value);
    }, debounceMs);

    const debouncedPlaySound = useDebouncedCallback(() => {
      if (playSound) {
        RNSystemSounds.play(resolvedSoundId);
      }
    }, debounceMs);

    const reportValue = useCallback(
      (offsetX: number, isFinal: boolean) => {
        const rawIndex = offsetX / itemSpacing;
        const clampedIndex = Math.max(
          0,
          Math.min(values.length - 1, Math.round(rawIndex)),
        );

        const value = values[clampedIndex];

        if (isFinal) {
          debouncedOnChange.cancel();
          debouncedPlaySound.cancel();
          onChangeEnd?.(value);
        } else {
          debouncedOnChange(value);
          debouncedPlaySound();
        }
      },
      [values, onChangeEnd, itemSpacing, debouncedOnChange, debouncedPlaySound],
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
          scheduleOnRN(reportValue, newX, false);
        }
      },

      onMomentumEnd: (event) => {
        velocityDirection.value = 0;
        scheduleOnRN(reportValue, event.contentOffset.x, true);
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
          contentContainerStyle={contentStyle}
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

// FIX #2: wrap in React.memo — renderItem was creating a new element every
// render, preventing Reanimated from skipping re-renders on stable bars
const SliderBar = React.memo(function SliderBar({
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
  const laggedDistance = useSharedValue(0);

  // Distance threshold beyond which a bar is fully at rest (gaussian ≈ 0).
  // Anything outside this range gets snapped to its resting value instantly
  // with no spring work — eliminates N-100+ simultaneous reactions firing
  // on every frame for out-of-view bars.
  const activationRadius = sigma * 3;

  // FIX #1 + #3: gate the reaction so distant bars are skipped entirely,
  // and bundle velocityDirection into the selector so the reaction only
  // fires when the (distance, direction) pair actually changes — not on
  // every scrollX tick for every bar regardless of proximity.
  useAnimatedReaction(
    () => {
      const dist = (scrollX.value - index * itemSpacing) / itemSpacing;
      return { dist, dir: velocityDirection.value };
    },
    ({ dist, dir }) => {
      const absDist = Math.abs(dist);

      // Bar is far from center — snap to fully-resting distance and bail.
      // No spring allocation, no per-frame work.
      if (absDist >= activationRadius) {
        laggedDistance.value = dist > 0 ? activationRadius : -activationRadius;
        return;
      }

      // Bar is near center — apply trailing spring logic as before.
      const isTrailing = dir === 1 ? dist > 0 : dir === -1 ? dist < 0 : false;

      if (isTrailing) {
        laggedDistance.value = withSpring(dist, trailingSpringConfig);
      } else {
        laggedDistance.value = dist;
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    const d = laggedDistance.value;
    const absd = Math.abs(d);

    const gaussian = Math.exp(-(d * d) / (2 * sigma * sigma));
    const height = minHeight + (maxHeight - minHeight) * gaussian;

    // FIX #4: short-circuit interpolateColor for bars outside the color fade
    // zone — the vast majority of bars at any given time. interpolateColor
    // is measurably heavier than a plain backgroundColor assignment.
    if (absd >= colorFadeDistance) {
      return { height, backgroundColor: inactiveColor };
    }

    const colorProgress = interpolate(
      absd,
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
});

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
