import React from "react";
import Icon from "@react-native-vector-icons/lucide";
import { StyleSheet, Text, View } from "react-native";

import { dailyFonts, DailyTheme } from "../theme";

interface MetaRowProps {
  icon: "book-open" | "timer";
  label: string;
  theme: DailyTheme;
}

/**
 * One line of card metadata: icon, then value.
 *
 * Stacked vertically by the card rather than laid out in a row — at a glance
 * "3 lines" and "~1 min" are two separate facts, and running them together on
 * one line with a dot made them read as a single breadcrumb.
 *
 * Muted, not ink: this is supporting detail sitting under the topic title, and
 * at full contrast it competed with it.
 */
export function MetaRow({ icon, label, theme }: MetaRowProps) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={theme.inkSoft} />
      <Text style={[styles.label, { color: theme.inkSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  label: { fontFamily: dailyFonts.medium, fontSize: 15.5, marginLeft: 10 },
});
