import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { colord } from "colord";

type ScriptDetailParams = {
  id: string;
  title: string;
  description: string;
  color: string;
  updatedAt: string;
  slideCount: string;
  durationMins: string;
};

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ScriptDetailScreen() {
  const params = useLocalSearchParams<ScriptDetailParams>();

  const script = useMemo(
    () => ({
      id: params.id,
      title: params.title,
      description: params.description,
      color: params.color,
      updatedAt: new Date(params.updatedAt),
      slideCount: Number(params.slideCount),
      durationMins: Number(params.durationMins),
    }),
    [params],
  );

  const borderColor = useMemo(
    () => colord(script.color).darken(0.4).toHex(),
    [script.color],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrapper}>
          <Link.AppleZoomTarget>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: script.color,
                  borderBottomColor: borderColor,
                },
              ]}
            />
          </Link.AppleZoomTarget>

          <View style={styles.heroContent} pointerEvents="none">
            <Text style={styles.heroTitle}>{script.title}</Text>
            <Text style={styles.heroDescription}>{script.description}</Text>

            <View style={styles.heroFooter}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  {script.slideCount} slides · {script.durationMins}m
                </Text>
              </View>
              <Text style={styles.heroTime}>
                {formatTime(script.updatedAt)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metaSection}>
          <Text style={styles.metaSectionLabel}>Last updated</Text>
          <Text style={styles.metaSectionValue}>
            {formatFullDate(script.updatedAt)} at {formatTime(script.updatedAt)}
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.bodyPlaceholder}>Script content goes here.</Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingTop: 24, paddingBottom: 48 },
  heroWrapper: { position: "relative" },
  heroCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
    borderBottomWidth: 6,
  },
  heroContent: { padding: 20 },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 10,
  },
  heroDescription: { fontSize: 15, lineHeight: 21, color: "#3C3C43" },
  heroFooter: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaPill: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaPillText: { fontSize: 13, fontWeight: "500", color: "#1C1C1E" },
  heroTime: { fontSize: 13, color: "#3C3C43", opacity: 0.7 },
  metaSection: { marginTop: 24 },
  metaSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  metaSectionValue: { fontSize: 15, color: "#1C1C1E" },
  body: { marginTop: 24 },
  bodyPlaceholder: { fontSize: 14, color: "#8E8E93" },
});
