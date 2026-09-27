import React from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import Icon from "@react-native-vector-icons/lucide";
import Svg, { Path } from "react-native-svg";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { MorphBlob } from "@/components/ui/morph-blob";
import {
  LottieMascot,
  Mascot,
} from "@/screens/daily-practice/components/Mascot";
import { NO_DECKS_MASCOT } from "@/constants/mascots";
import { PressableCard } from "@/screens/daily-practice/components/PressableCard";
import { dailyFonts, dailyTheme, radius } from "@/screens/daily-practice/theme";

type Kind = "empty" | "error" | "search" | "noResults";

interface Action {
  label: string;
  onPress: () => void;
}

interface EmptyStateProps {
  kind: Kind;
  title: string;
  description: React.ReactNode;
  primary?: Action & { icon?: "rotate-cw" };
  secondary?: Action;
}

const ART: Record<Kind, { note: string; cloud: string; cloudDark: string }> = {
  empty: {
    note: "Looks a\nbit empty\nhere!",
    cloud: "#FBE0EB",
    cloudDark: "#3A2530",
  },
  error: {
    note: "Oops!\nSomething\nwent wrong.",
    cloud: "#E4E9FB",
    cloudDark: "#232A3D",
  },
  search: {
    note: "What are we\nlooking for\ntoday?",
    cloud: "#E6E1FB",
    cloudDark: "#26223A",
  },
  noResults: {
    note: "Hmm… not\nin here\neither!",
    cloud: "#FFE4D2",
    cloudDark: "#3A2719",
  },
};

/** Mascot art is 260 × 210. */
const MASCOT_W = 272;
const MASCOT_H = (MASCOT_W * 210) / 260;

/**
 * Discover's empty and error states: a character on a breathing pastel cloud,
 * a handwritten aside, then the words and the way out.
 */
export function EmptyState({
  kind,
  title,
  description,
  primary,
  secondary,
}: EmptyStateProps) {
  const isDark = useColorScheme() === "dark";
  const theme = dailyTheme(isDark);
  const art = ART[kind];

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(420)} style={styles.stage}>
        {/* Two overlapping blobs read as one lumpy cloud, wider than the
            character so it spills out on both sides. */}
        <MorphBlob
          seed={`cloud-${kind}-l`}
          width={250}
          height={170}
          color={isDark ? art.cloudDark : art.cloud}
          period={8000}
          drift={6}
          style={styles.cloudLeft}
        />
        <MorphBlob
          seed={`cloud-${kind}-r`}
          width={290}
          height={210}
          color={isDark ? art.cloudDark : art.cloud}
          period={9500}
          drift={6}
          style={styles.cloudRight}
        />
        <View style={styles.mascot}>
          {kind === "empty" ? (
            // Same box as the PNG poses, so the cloud and note stay put.
            <View style={styles.mascotBox}>
              <LottieMascot mascot={NO_DECKS_MASCOT} size={MASCOT_H} />
            </View>
          ) : (
            <Mascot pose={kind} size={MASCOT_W} style={{ height: MASCOT_H }} />
          )}
        </View>

        {/* Voice, not data — decorative, so hidden from VoiceOver. */}
        <View
          style={styles.aside}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={[styles.note, { color: theme.inkSoft }]}>
            {art.note}
          </Text>
          <Svg width={40} height={46} viewBox="0 0 40 46" style={styles.arrow}>
            <Path
              d="M 8 4 C 2 18 8 32 30 40 M 30 40 L 17 41 M 30 40 L 25 28"
              stroke={theme.inkSoft}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(420).springify().damping(70)}
        style={styles.copy}
      >
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        <Text style={[styles.description, { color: theme.inkSoft }]}>
          {description}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(200).duration(420).springify().damping(70)}
        style={styles.actions}
      >
        {primary ? (
          <PressableCard
            onHaptic={haptics.advance}
            onPress={primary.onPress}
            accessibilityRole="button"
            accessibilityLabel={primary.label}
            style={[styles.primary, { backgroundColor: theme.button }]}
          >
            {primary.icon ? (
              <Icon name={primary.icon} size={19} color={theme.buttonInk} />
            ) : null}
            <Text style={[styles.primaryText, { color: theme.buttonInk }]}>
              {primary.label}
            </Text>
          </PressableCard>
        ) : null}
        {secondary ? (
          <PressableCard
            onHaptic={haptics.advance}
            onPress={secondary.onPress}
            accessibilityRole="button"
            accessibilityLabel={secondary.label}
            style={[styles.secondary, { backgroundColor: theme.buttonSoft }]}
          >
            <Text style={[styles.secondaryText, { color: theme.ink }]}>
              {secondary.label}
            </Text>
          </PressableCard>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * The floating pastel corners behind the empty states, edge to edge — the
 * screen's header is transparent, so absoluteFill already runs under the
 * status bar.
 *
 * Rendered before the list so it paints underneath the category chips. That
 * makes it the screen's first native child, which the large title uses to find
 * its scroll view — acceptable because it only exists while a state is
 * showing, when there is nothing to scroll.
 */
/** Top-right, bottom-left, bottom-right. */
type Corners = [string, string, string];
const DISCOVER_CORNERS: Corners = ["#E3DDFB", "#FBE6BE", "#F9D3E4"];

export function FloatingBackdrop({
  colors = DISCOVER_CORNERS,
}: {
  colors?: Corners;
}) {
  const isDark = useColorScheme() === "dark";
  const alpha = isDark ? 0.14 : 0.75;

  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MorphBlob
        seed="bg-top"
        width={230}
        height={200}
        color={colors[0]}
        opacity={alpha * 0.8}
        drift={14}
        style={{ top: -70, right: -90 }}
      />
      <MorphBlob
        seed="bg-left"
        width={300}
        height={360}
        color={colors[1]}
        opacity={alpha}
        drift={16}
        period={11000}
        style={{ bottom: -110, left: -140 }}
      />
      <MorphBlob
        seed="bg-right"
        width={300}
        height={320}
        color={colors[2]}
        opacity={alpha}
        drift={16}
        period={10000}
        style={{ bottom: -120, right: -130 }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", paddingTop: 44, paddingBottom: 24 },

  stage: { width: 340, height: 280 },
  cloudLeft: { left: -26, top: 106 },
  cloudRight: { left: 96, top: 52 },
  mascot: { position: "absolute", left: 44, top: 56 },
  mascotBox: {
    width: MASCOT_W,
    height: MASCOT_H,
    alignItems: "center",
    justifyContent: "center",
  },
  aside: {
    position: "absolute",
    left: -6,
    top: -8,
    transform: [{ rotate: "-14deg" }],
  },
  note: {
    fontFamily: dailyFonts.handwritten,
    fontSize: 17,
    lineHeight: 22,
  },
  arrow: { marginTop: 4, marginLeft: 26 },

  copy: { alignItems: "center", marginTop: 14, paddingHorizontal: 16 },
  title: {
    fontFamily: dailyFonts.display,
    fontSize: 25,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  description: {
    fontFamily: dailyFonts.body,
    fontSize: 15.5,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
  },

  actions: { alignSelf: "stretch", paddingHorizontal: 56, marginTop: 24 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radius.button,
    paddingVertical: 17,
  },
  primaryText: { fontFamily: dailyFonts.semibold, fontSize: 16.5 },
  secondary: {
    alignItems: "center",
    borderRadius: radius.button,
    paddingVertical: 16,
    marginTop: 12,
  },
  secondaryText: { fontFamily: dailyFonts.semibold, fontSize: 16 },
});
