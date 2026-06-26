import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";

import { getRandomIntExclusive } from "@/utils/getRandomNumber";
import { Card } from "./Card";
import { COLUMN_GAP, SCREEN_PADDING } from "./constants";

// ---------- Types ----------

export type ScriptItem = {
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

// ---------- Card ----------

// ---------- Screen ----------

const AllScriptsScreen = () => {
  const renderItem: ListRenderItem<ScriptItem> = useCallback(
    ({ item, index }) => <Card item={item} index={index} />,
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
  screenContent: {
    paddingHorizontal: SCREEN_PADDING - COLUMN_GAP / 2,
    paddingBottom: 24,
    paddingTop: 24,
  },
});
