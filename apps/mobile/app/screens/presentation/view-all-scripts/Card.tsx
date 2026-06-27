import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colord } from "colord";
import { Link } from "expo-router";

import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { getCardTitleMargin } from "@/utils/getCardTitleMargin";
import { ScriptItem } from ".";
import { COLUMN_GAP } from "./constants";

const JELLY_SPRING = {
  damping: 8,
  stiffness: 120,
  mass: 0.6,
  overshootClamping: false,
};

export const Card = ({ item, index }: { item: ScriptItem; index: number }) => {
  const scale = useSharedValue(0.55);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    const delay = (index % 8) * 55;

    // Fade + slide in quickly with a simple timing so they don't linger
    opacity.value = withDelay(delay, withTiming(1, { duration: 180 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 30, stiffness: 160 }),
    );

    // Scale gets the full jelly treatment
    scale.value = withDelay(delay, withSpring(1, JELLY_SPRING));
  }, [index, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transformOrigin: ["50%", "0%", 0],
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: item.color }, animatedStyle]}
    >
      <Link
        style={styles.cardPressable}
        href={{
          pathname: "/(authenticated)/(script)/[id]",
          params: {
            id: item.id,
            title: item.title,
            description: item.description,
            color: item.color,
            updatedAt: item.updatedAt.toISOString(),
            slideCount: String(item.slideCount),
            durationMins: String(item.durationMins),
            isFavourite: JSON.stringify(item.isFavourite),
          },
        }}
        asChild
      >
        <Link.AppleZoom>
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => [
              styles.cardPressable,
              pressed && styles.cardPressed,
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                {
                  color: colord(item.color).darken(0.5).toHex(),
                  marginBottom: getCardTitleMargin(item.slideCount),
                },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>

            <View style={styles.cardFooter}>
              <View
                style={[
                  styles.slideCountPill,
                  {
                    backgroundColor: colord(item.color)
                      .lighten(0.08)
                      .desaturate(0.08)
                      .toHex(),
                  },
                ]}
              >
                <MaterialDesignIcons
                  name="cards-playing"
                  size={24}
                  color={colord(item.color)
                    .darken(0.35)
                    .desaturate(0.24)
                    .toHex()}
                />
                <Text
                  style={[
                    styles.slideCountText,
                    {
                      color: colord(item.color)
                        .darken(0.35)
                        .desaturate(0.24)
                        .toHex(),
                    },
                  ]}
                >
                  {item.slideCount}
                </Text>
              </View>

              <Text
                style={[
                  styles.cardTime,
                  {
                    color: colord(item.color)
                      .darken(0.35)
                      .desaturate(0.24)
                      .toHex(),
                  },
                ]}
              >
                {item.durationMins}m
              </Text>
            </View>
          </Pressable>
        </Link.AppleZoom>
      </Link>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 40,
    overflow: "hidden",
    marginHorizontal: COLUMN_GAP / 2,
    marginBottom: COLUMN_GAP,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cardPressable: {
    padding: 14,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
    fontFamily: "KronaOne",
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#3C3C43",
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaPill: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  cardTime: {
    fontSize: 20,
    fontWeight: "700",
    transform: [{ translateY: 12 }, { translateX: -5 }],
  },
  slideCountPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    borderRadius: 100,
    gap: 8,
    transform: [{ translateX: -5 }],
  },
  slideCountText: {
    fontSize: 20,
    fontWeight: "700",
  },
});
