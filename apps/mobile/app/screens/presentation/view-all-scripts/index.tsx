import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import Animated, {
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";
import { colord } from "colord";
import { Link } from "expo-router";
// ---------- Types ----------

type ScriptItem = {
  id: string;
  title: string;
  description: string;
  color: string; // hex stored directly on the data item
  updatedAt: Date;
  slideCount: number;
  durationMins: number;
};

// ---------- Mock data ----------
// description length varies on purpose to exercise the masonry layout

const DATA: ScriptItem[] = [
  {
    id: "1",
    title: "Product Launch",
    description:
      "Opening hook, problem framing, three feature highlights, and a closing CTA slide.",
    color: "#FDE8C8",
    updatedAt: new Date(2026, 5, 23, 12, 34),
    slideCount: 12,
    durationMins: 8,
  },
  {
    id: "2",
    title: "Q3 Investor Update",
    description: "Revenue, churn, roadmap.",
    color: "#D7EAF3",
    updatedAt: new Date(2026, 5, 21, 9, 10),
    slideCount: 6,
    durationMins: 5,
  },
  {
    id: "3",
    title: "Team Onboarding Deck",
    description:
      "Company values, org chart walkthrough, tools setup, first-week expectations, and where to find help when you're stuck.",
    color: "#E3D9F2",
    updatedAt: new Date(2026, 5, 20, 16, 2),
    slideCount: 18,
    durationMins: 14,
  },
  {
    id: "4",
    title: "Design Review",
    description: "Wireframes for the onboarding flow.",
    color: "#FBD9DF",
    updatedAt: new Date(2026, 5, 18, 11, 45),
    slideCount: 9,
    durationMins: 6,
  },
  {
    id: "5",
    title: "Conference Talk",
    description: "Intro, three case studies, takeaways.",
    color: "#D9F0E1",
    updatedAt: new Date(2026, 5, 15, 14, 0),
    slideCount: 15,
    durationMins: 20,
  },
  {
    id: "6",
    title: "Sales Pitch v2",
    description:
      "Updated pricing tiers, competitor comparison table, and customer testimonial slide added after last week's feedback.",
    color: "#FFF2C7",
    updatedAt: new Date(2026, 5, 12, 17, 30),
    slideCount: 10,
    durationMins: 7,
  },
];

// ---------- Helpers ----------

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(date: Date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return formatTime(date);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ---------- Card ----------

const CardItem = ({ item, index }: { item: ScriptItem; index: number }) => {
  return (
    <Animated.View
      entering={FadeInDown.delay((index % 8) * 40)
        .duration(280)
        .springify()
        .damping(70)}
      style={[
        styles.card,
        {
          backgroundColor: item.color,
          borderBottomColor: colord(item.color).darken(0.4).toHex(),
        },
      ]}
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
            onPress={() => {
              // navigate to script detail
            }}
            style={({ pressed }) => [
              styles.cardPressable,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardDescription} numberOfLines={6}>
              {item.description}
            </Text>

            <View style={styles.cardFooter}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  {item.slideCount} slides · {item.durationMins}m
                </Text>
              </View>
              <Text style={styles.cardTime}>{formatDate(item.updatedAt)}</Text>
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

  return (
    <View style={styles.screen}>
      <FlashList
        data={DATA}
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
    borderRadius: 16,
    borderColor: "black",
    borderWidth: 1,
    borderBottomWidth: 5,

    overflow: "hidden",
    marginHorizontal: COLUMN_GAP / 2,
    marginBottom: COLUMN_GAP,
  },
  cardPressable: {
    padding: 14,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
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
    fontSize: 11,
    color: "#3C3C43",
    opacity: 0.7,
  },
});
