import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Link } from "expo-router";

import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { getCardTitleMargin } from "@/utils/getCardTitleMargin";
import { deckCardColors } from "@/utils/deck-colors";
import { DeckItem } from "@/services/deck.service";
import { COLUMN_GAP } from "./constants";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";

const JELLY_SPRING = {
  damping: 8,
  stiffness: 120,
  mass: 0.6,
  overshootClamping: false,
};

export const Card = React.memo(
  ({ item, index }: { item: DeckItem; index: number }) => {
    const scale = useSharedValue(0.55);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(24);

    useEffect(() => {
      const delay = (index % 8) * 55;

      opacity.value = withDelay(delay, withTiming(1, { duration: 180 }));
      translateY.value = withDelay(
        delay,
        withSpring(0, { damping: 30, stiffness: 160 }),
      );
      scale.value = withDelay(delay, withSpring(1, JELLY_SPRING));
    }, [index, opacity, scale, translateY]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transformOrigin: ["50%", "0%", 0],
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
      borderRadius: 40,
      overflow: "hidden",
      marginHorizontal: COLUMN_GAP / 2,
      marginBottom: COLUMN_GAP,
    }));

    const {
      title: titleColor,
      accent: accentColor,
      pill: pillColor,
    } = deckCardColors(item.color);

    return (
      <Link
        href={{
          pathname: "/(authenticated)/(script)/[id]",
          params: {
            id: item.id,
            title: item.title,
            description: item.description,
            color: item.color,
            updatedAt: item.updatedAt,
            slideCount: String(item.slideCount),
            durationMins: String(item.durationMins),
            isFavourite: JSON.stringify(item.isFavourite),
          },
        }}
        asChild
      >
        <Link.AppleZoom>
          <AnimatedPressable style={animatedStyle}>
            <Animated.View
              style={[
                { backgroundColor: item.color },
                styles.cardPressable,
                animatedStyle,
              ]}
            >
              <Text
                numberOfLines={2}
                style={[
                  styles.cardTitle,
                  {
                    color: titleColor,
                    marginBottom: getCardTitleMargin(item.slideCount),
                  },
                ]}
              >
                {item.title}
              </Text>

              <View style={styles.cardFooter}>
                <View
                  style={[
                    styles.slideCountPill,
                    {
                      backgroundColor: pillColor,
                    },
                  ]}
                >
                  <MaterialDesignIcons
                    name="cards-playing"
                    size={24}
                    color={accentColor}
                  />
                  <Text
                    style={[
                      styles.slideCountText,
                      {
                        color: accentColor,
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
                      color: accentColor,
                    },
                  ]}
                >
                  {item.durationMins}m
                </Text>
              </View>
            </Animated.View>
          </AnimatedPressable>
        </Link.AppleZoom>
      </Link>
    );
  },
);

Card.displayName = "Card";

const styles = StyleSheet.create({
  card: {
    borderRadius: 40,
    overflow: "hidden",
    marginHorizontal: COLUMN_GAP / 2,
    marginBottom: COLUMN_GAP,
  },
  cardPressable: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
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
