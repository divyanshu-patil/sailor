/* eslint-disable react-hooks/immutability */
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colord } from "colord";
import Animated, {
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";

interface PillProps {
  variant: "duration" | "date";
  durationMins?: number;
  date?: Date;
  color: string;
  delay?: number; // stagger multiple pills
}

const ICON_SIZE = 50;

const SPRING_CONFIG = {
  damping: 30,
  stiffness: 180,
};

const ANIMATION_INITIAL = {
  scale: 0,
  opacity: 0,
  rotate: -15,
};

const Pill = ({ variant, durationMins, date, color, delay = 0 }: PillProps) => {
  const bgColor = colord(color).lighten(0.05).toHex();
  const textColor = colord(color).darken(0.25).desaturate(0.5).toHex();
  const iconColor = colord(color).darken(0.35).desaturate(0.5).toHex();
  const iconContainerColor = colord(color).darken(0.07).desaturate(0.2).toHex();

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(-5);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    scale.value = ANIMATION_INITIAL.scale;
    opacity.value = ANIMATION_INITIAL.opacity;
    rotate.value = ANIMATION_INITIAL.rotate;

    scale.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
    opacity.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
    rotate.value = withDelay(delay, withSpring(0, SPRING_CONFIG)); // target: 0 degrees
  }, [delay, opacity, rotate, scale]);

  const ClockIcon = (
    <FontAwesome6
      name="stopwatch"
      iconStyle="solid"
      color={iconColor}
      size={24}
    />
  );
  const CalendarIcon = (
    <MaterialDesignIcons name="calendar" size={24} color={iconColor} />
  );

  return (
    <Animated.View layout={LinearTransition.springify()} style={animatedStyle}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: iconContainerColor },
          ]}
        >
          {variant === "duration" ? ClockIcon : CalendarIcon}
        </View>
        {variant === "duration" ? (
          <Text style={[styles.text, { color: textColor }]}>
            {durationMins} min
          </Text>
        ) : (
          <>
            <Text style={[styles.text, styles.dateText, { color: textColor }]}>
              {`${date?.getDate()} ${date?.toLocaleString("en-US", { month: "short" })}`}
            </Text>
            <Text
              style={[styles.text, styles.dateYearText, { color: textColor }]}
            >
              {date?.getFullYear()}
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
};

export default Pill;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    paddingLeft: 40,
    justifyContent: "center",
    borderRadius: 26,
    alignItems: "flex-end",
    position: "relative",
  },
  iconContainer: {
    position: "absolute",
    left: -ICON_SIZE / 2,
    width: ICON_SIZE,
    aspectRatio: 1,
    borderRadius: ICON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 30,
    fontFamily: "KronaOne",
  },
  dateText: {
    transform: [{ translateY: -10 }, { translateX: -5 }],
  },
  dateYearText: {
    position: "absolute",
    fontSize: 16,
    bottom: 10,
    right: 15,
  },
});
