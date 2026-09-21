import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colord } from "colord";
import { Link } from "expo-router";

import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { DeckItem } from "@/services/deck.service";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import { weight } from "@/lib/haptics";
import Spacer from "@/components/ui/shared/spacer";
import { fonts } from "@/constants/fonts";

const JELLY_SPRING = {
  damping: 8,
  stiffness: 120,
  mass: 0.6,
};

const Card = React.memo(({ item }: { item: DeckItem }) => {
  const titleColor = colord(item.color).darken(0.5).toHex();
  const accentColor = colord(item.color).darken(0.35).desaturate(0.24).toHex();
  const pillColor = colord(item.color).lighten(0.08).desaturate(0.08).toHex();

  const scale = useSharedValue(0.55);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 });
    translateY.value = withSpring(0, { damping: 30, stiffness: 160 });
    scale.value = withSpring(1, JELLY_SPRING);
  }, [opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transformOrigin: ["50%", "0%", 0],
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    borderRadius: 40,
    overflow: "hidden",
  }));
  return (
    <Animated.View style={[styles.container]}>
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
        // On the Link rather than the Pressable inside it: `asChild` renders a
        // Slot that hands its own onPress down, so one set there would be
        // dropped. Link composes — ours runs, then it navigates.
        onPress={weight.tap}
        asChild
      >
        <Link.AppleZoom>
          <AnimatedPressable style={animatedStyle}>
            <Animated.View
              style={[{ backgroundColor: item.color }, styles.cardPressable]}
            >
              <Text
                numberOfLines={3}
                style={[
                  styles.cardTitle,
                  {
                    color: titleColor,
                  },
                ]}
              >
                {item.title}
              </Text>

              <Spacer />

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
                    size={32}
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
    </Animated.View>
  );
});
export default Card;
Card.displayName = "Card";

const styles = StyleSheet.create({
  spacer: { flex: 1 },
  container: {
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 40,
    overflow: "hidden",
  },
  cardPressable: {
    paddingHorizontal: 30,
    paddingVertical: 26,

    width: "100%",
    aspectRatio: 3 / 4,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTitle: {
    fontSize: 30,
    fontWeight: "700",
    fontFamily: fonts.krona,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#3C3C43",
  },
  cardFooter: {
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
    fontSize: 14,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  cardTime: {
    fontSize: 20,
    fontWeight: "700",
    transform: [{ translateY: 12 }, { translateX: -5 }],
  },
  slideCountPill: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    borderRadius: 100,
    gap: 8,
    transform: [{ translateX: -5 }],
  },
  slideCountText: {
    fontSize: 30,
    fontWeight: "700",
  },
});
