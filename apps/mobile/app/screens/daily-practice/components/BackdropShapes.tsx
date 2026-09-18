import React from "react";
import { StyleSheet, View } from "react-native";

import { DailyTheme } from "../theme";

/**
 * Soft colour blobs behind the explainer's content.
 *
 * Plain tinted circles at low opacity rather than an image or a Skia canvas:
 * they only need to break up a flat sheet of off-white, and at this opacity the
 * cheapest thing that does the job is indistinguishable from an expensive one.
 * Purely decorative, so hidden from the accessibility tree.
 */
export function BackdropShapes({ theme }: { theme: DailyTheme }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.blob, styles.topRight, { backgroundColor: theme.accent }]} />
      <View style={[styles.blob, styles.midLeft, { backgroundColor: "#A0A3FF" }]} />
      <View style={[styles.blob, styles.bottomRight, { backgroundColor: "#F4D35E" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: "absolute", borderRadius: 999, opacity: 0.1 },
  topRight: { width: 230, height: 230, top: -80, right: -70 },
  midLeft: { width: 180, height: 180, top: 300, left: -90 },
  bottomRight: { width: 210, height: 210, bottom: -70, right: -60 },
});
