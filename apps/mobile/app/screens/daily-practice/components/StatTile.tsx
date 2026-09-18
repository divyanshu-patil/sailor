import React from "react";
import Icon from "@react-native-vector-icons/lucide";
import { StyleSheet, Text, View } from "react-native";

import { dailyFonts, DailyTheme } from "../theme";

interface StatTileProps {
  icon: "timer" | "file-text" | "flame";
  value: string;
  label: string;
  theme: DailyTheme;
}

/**
 * Icon above, number, then label — the reference's stacked stat.
 *
 * The icon carries the accent colour while the number stays ink: three tinted
 * numbers side by side compete with each other, and the number is the thing
 * being read.
 */
export function StatTile({ icon, value, label, theme }: StatTileProps) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={24} color={theme.accent} />
      <Text style={[styles.value, { color: theme.ink }]}>{value}</Text>
      <Text style={[styles.label, { color: theme.inkSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: "center", paddingVertical: 4 },
  value: { fontFamily: dailyFonts.display, fontSize: 25, marginTop: 9, letterSpacing: -0.3 },
  label: { fontFamily: dailyFonts.body, fontSize: 12.5, marginTop: 3 },
});
