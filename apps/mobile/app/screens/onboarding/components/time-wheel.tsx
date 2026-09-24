import { memo, type Ref, useEffect, useImperativeHandle } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import PressableScale from "@/components/ui/animated/PressableScale";
import { haptics } from "@/lib/haptics";
import { PROFILE, profileFonts } from "@/screens/profile/theme";

export const WHEEL_ITEM = 50;
const VISIBLE = 5;

export interface WheelHandle {
  scrollToIndex: (index: number) => void;
}

const WheelItem = memo(function WheelItem({
  label,
  index,
  offset,
}: {
  label: string;
  index: number;
  offset: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const d = (offset.value - index * WHEEL_ITEM) / WHEEL_ITEM;
    const a = Math.abs(d);
    return {
      opacity: interpolate(
        a,
        [0, 1, 2.2],
        [1, 0.42, 0.12],
        Extrapolation.CLAMP,
      ),
      transform: [
        { perspective: 500 },
        {
          rotateX: `${interpolate(d, [-2.5, 0, 2.5], [48, 0, -48], Extrapolation.CLAMP)}deg`,
        },
        {
          scale: interpolate(
            a,
            [0, 1, 2],
            [1, 0.88, 0.78],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  return (
    <Animated.View style={[styles.item, style]}>
      <Text style={styles.itemLabel}>{label}</Text>
    </Animated.View>
  );
});

/**
 * One snapping wheel. Scroll position lives on the UI thread: the fade, the
 * roll and the haptic tick per row all run there, and JS only hears about the
 * row it settled on — so the wheel stays smooth however busy JS is.
 */
export const Wheel = memo(function Wheel({
  values,
  initialIndex,
  onChange,
  width,
  ref,
}: {
  values: string[];
  initialIndex: number;
  onChange: (index: number) => void;
  width: number;
  ref?: Ref<WheelHandle>;
}) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(initialIndex * WHEEL_ITEM);
  const lastIndex = useSharedValue(initialIndex);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) =>
      scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM, animated: true }),
  }));

  const settle = (y: number) => {
    const index = Math.max(
      0,
      Math.min(values.length - 1, Math.round(y / WHEEL_ITEM)),
    );
    onChange(index);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      offset.value = e.contentOffset.y;
      const index = Math.round(e.contentOffset.y / WHEEL_ITEM);
      if (index !== lastIndex.value && index >= 0 && index < values.length) {
        lastIndex.value = index;
        haptics.select();
      }
    },
    onMomentumEnd: (e) => {
      scheduleOnRN(settle, e.contentOffset.y);
    },
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ width, height: WHEEL_ITEM * VISIBLE }}
      contentContainerStyle={{ paddingVertical: WHEEL_ITEM * 2 }}
      contentOffset={{ x: 0, y: initialIndex * WHEEL_ITEM }}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM}
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={16}
      accessibilityRole="adjustable"
    >
      {values.map((label, i) => (
        <WheelItem key={label} label={label} index={i} offset={offset} />
      ))}
    </Animated.ScrollView>
  );
});

/** AM / PM as a vertical pill with an ink thumb that springs between them. */
export const PeriodToggle = memo(function PeriodToggle({
  value,
  onChange,
}: {
  value: "AM" | "PM";
  onChange: (value: "AM" | "PM") => void;
}) {
  const position = useSharedValue(value === "AM" ? 0 : 1);

  useEffect(() => {
    position.value = withSpring(value === "AM" ? 0 : 1, {
      damping: 70,
    });
  }, [position, value]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateY: position.value * PERIOD_ROW }],
  }));
  const amLabel = useAnimatedStyle(() => ({
    color: position.value < 0.5 ? PROFILE.white : PROFILE.ink,
  }));
  const pmLabel = useAnimatedStyle(() => ({
    color: position.value >= 0.5 ? PROFILE.white : PROFILE.ink,
  }));

  return (
    <View style={styles.period}>
      <Animated.View style={[styles.periodThumb, thumb]} />
      {(["AM", "PM"] as const).map((period) => (
        <PressableScale
          key={period}
          onPress={() => {
            if (period !== value) onChange(period);
          }}
          haptic={haptics.select}
          style={styles.periodRow}
          accessibilityRole="button"
          accessibilityState={{ selected: period === value }}
          accessibilityLabel={period}
        >
          <Animated.Text
            style={[styles.periodLabel, period === "AM" ? amLabel : pmLabel]}
          >
            {period}
          </Animated.Text>
        </PressableScale>
      ))}
    </View>
  );
});

const PERIOD_ROW = 46;

const styles = StyleSheet.create({
  item: {
    height: WHEEL_ITEM,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    fontFamily: profileFonts.display,
    fontSize: 34,
    letterSpacing: -0.8,
    color: PROFILE.ink,
    fontVariant: ["tabular-nums"],
  },
  period: {
    width: 64,
    height: PERIOD_ROW * 2 + 8,
    padding: 4,
    borderRadius: 22,
    backgroundColor: "#F4ECE1",
  },
  periodThumb: {
    position: "absolute",
    left: 4,
    top: 4,
    width: 56,
    height: PERIOD_ROW,
    borderRadius: 18,
    backgroundColor: PROFILE.ink,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  periodRow: {
    height: PERIOD_ROW,
    alignItems: "center",
    justifyContent: "center",
  },
  periodLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 16,
    letterSpacing: 0.4,
  },
});
