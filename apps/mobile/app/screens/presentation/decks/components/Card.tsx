import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
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
import { weight } from "@/lib/haptics";
import { fonts } from "@/constants/fonts";

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

    /**
     * The entrance plays once per cell, on the cell's own first render.
     *
     * FlashList recycles cells: scrolling hands an existing instance a new
     * item and a new index rather than mounting a component. Keying this
     * effect on `index` therefore re-ran three springs on every row that came
     * into view, all the way down the list — which is what made scrolling
     * drop frames. A card that has already arrived stays arrived.
     */
    const hasEntered = useRef(false);
    useEffect(() => {
      if (hasEntered.current) return;
      hasEntered.current = true;

      const delay = (index % 8) * 55;
      opacity.value = withDelay(delay, withTiming(1, { duration: 180 }));
      translateY.value = withDelay(
        delay,
        withSpring(0, { damping: 30, stiffness: 160 }),
      );
      scale.value = withDelay(delay, withSpring(1, JELLY_SPRING));
      // `index` is read once, for the stagger, and deliberately not depended
      // on: a recycled cell must not animate again.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opacity, scale, translateY]);

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
        // On the Link rather than the Pressable inside it: `asChild` renders a
        // Slot that hands its own onPress down, so one set there would be
        // dropped. Link composes — ours runs, then it navigates.
        onPress={weight.tap}
        asChild
      >
        <Link.AppleZoom>
          <AnimatedPressable style={animatedStyle}>
            {/* The animated style belongs to the pressable above and nothing
                else. It used to be applied here as well, which ran the same
                transform twice per frame on every visible card. */}
            <View style={[{ backgroundColor: item.color }, styles.cardPressable]}>
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
            </View>
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
    fontFamily: fonts.krona,
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
