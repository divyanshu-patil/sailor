import React, { useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
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
import { getRandomIntExclusive } from "@/utils/getRandomNumber";
import { getCardTitleMargin } from "@/utils/getCardTitleMargin";

// ---------- Types ----------

type ScriptItem = {
  id: string;
  title: string;
  description: string;
  color: string;
  updatedAt: Date;
  slideCount: number;
  durationMins: number;
  mb?: number;
};

// ---------- Mock data ----------

const DATA: ScriptItem[] = [
  {
    id: "1",
    title: "Product Launch",
    description:
      "Opening hook, problem framing, three feature highlights, and a closing CTA slide.",
    color: "#A0A3FF",
    updatedAt: new Date(2026, 5, 23, 12, 34),
    slideCount: 12,
    durationMins: 8,
  },
  {
    id: "2",
    title: "Q3 Investor Update",
    description: "Revenue, churn, roadmap.",
    color: "#FFC88A",
    updatedAt: new Date(2026, 5, 21, 9, 10),
    slideCount: 6,
    durationMins: 5,
  },
  {
    id: "3",
    title: "Team Onboarding Deck",
    description:
      "Company values, org chart walkthrough, tools setup, first-week expectations, and where to find help when you're stuck.",
    color: "#EFC1FF",
    updatedAt: new Date(2026, 5, 20, 16, 2),
    slideCount: 18,
    durationMins: 14,
  },
  {
    id: "4",
    title: "Design Review",
    description: "Wireframes for the onboarding flow.",
    color: "#A1AFDE",
    updatedAt: new Date(2026, 5, 18, 11, 45),
    slideCount: 9,
    durationMins: 6,
  },
  {
    id: "5",
    title: "Conference Talk",
    description: "Intro, three case studies, takeaways.",
    color: "#F78199",
    updatedAt: new Date(2026, 5, 15, 14, 0),
    slideCount: 15,
    durationMins: 20,
  },
  {
    id: "6",
    title: "Sales Pitch v2",
    description:
      "Updated pricing tiers, competitor comparison table, and customer testimonial slide added after last week's feedback.",
    color: "#ACCCC0",
    updatedAt: new Date(2026, 5, 12, 17, 30),
    slideCount: 10,
    durationMins: 7,
  },
];

// ---------- Jelly spring config ----------
// Low damping = lots of bounce. Mass adds weight to the wobble.

const JELLY_SPRING = {
  damping: 8,
  stiffness: 120,
  mass: 0.6,
  overshootClamping: false,
};

// ---------- Card ----------

const CardItem = ({ item, index }: { item: ScriptItem; index: number }) => {
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

// ---------- Screen ----------

const COLUMN_GAP = 10;
const SCREEN_PADDING = 12;

const AllScriptsScreen = () => {
  const renderItem: ListRenderItem<ScriptItem> = useCallback(
    ({ item, index }) => <CardItem item={item} index={index} />,
    [],
  );

  const DATA_W_MB = useMemo(
    () =>
      DATA.map((it) => ({
        ...it,
        mb: getRandomIntExclusive(10, 90),
      })),
    [],
  );

  return (
    <View style={styles.screen}>
      <FlashList
        data={DATA_W_MB}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        masonry
        numColumns={2}
        optimizeItemArrangement
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default AllScriptsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  screenContent: {
    paddingHorizontal: SCREEN_PADDING - COLUMN_GAP / 2,
    paddingBottom: 24,
    paddingTop: 24,
  },
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
