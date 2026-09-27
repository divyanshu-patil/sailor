import { memo, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Icon from "@react-native-vector-icons/lucide";
import Animated, { useSharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import OrganicBlob from "@/components/ui/organic-blob";
import SkiaMascot from "@/components/ui/skia-mascot";
import { HOME_BUTTON_MASCOT } from "@/constants/mascots";

import {
  homeColors,
  homeFonts,
  homeRadius,
  homeShadow,
  streakDisplay,
  wellFor,
} from "../theme";
import PressableScale from "@/components/ui/animated/PressableScale";

/**
 * The decorative shapes that sit in a card's corners.
 *
 * `OrganicBlob` already generates a seeded silhouette with `@shapesoup/core`
 * and is used on the auth screens, so it is reused here rather than a second
 * blob component written. It reveals itself from a transition's progress value,
 * which home has none of — a shared value pinned at 1 is what "already
 * revealed" looks like to it, and costs one `useSharedValue` per card.
 */
export interface CardBlob {
  seed: string;
  width: number;
  height: number;
  color: string;
  x: number;
  y: number;
  opacity?: number;
  rotation?: number;
}

/** Two ticks — the design's punctuation, scattered on every card. The colour
 *  is per card: a spark has to be one of the four hues that the card it lands
 *  on is not. */
export interface CardSpark {
  style: object;
  color: string;
  size?: number;
}

const Sparks = memo(function Sparks({
  style,
  size = 26,
  color,
}: {
  style: object;
  size?: number;
  color: string;
}) {
  return (
    <View pointerEvents="none" style={[styles.decor, style]}>
      <Svg width={size} height={size} viewBox="0 0 30 30" fill="none">
        <Path
          d="M6 22 L13 8"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          d="M18 24 L25 10"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
});

/** The little curl from the design's second card. */
const Squiggle = memo(function Squiggle({
  style,
  color,
}: {
  style: object;
  color: string;
}) {
  return (
    <View pointerEvents="none" style={[styles.decor, style]}>
      <Svg width={44} height={22} viewBox="0 0 44 22" fill="none">
        <Path
          d="M3 17 C5 5, 15 4, 16 12 C17 19, 24 19, 25 11 C26 3, 36 4, 40 14"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
});

export interface ActionCardProps {
  title: string;
  /** Two short lines, as in the design. */
  subtitle: string;
  icon: ComponentProps<typeof Icon>["name"];
  /** The card's surface — this is what identifies it, before its label. The
   *  wells behind the glyph and the arrow are derived from it. */
  tint: string;
  blobs: CardBlob[];
  sparks?: CardSpark[];
  squiggle?: { style: object; color: string };
  /**
   * The mascot peeking over a card edge. `size`, `left` and `bottom` describe
   * the visible character, not the Lottie canvas around it. `first` picks the
   * file's orange pose (`shouldPlayFirst`) over the pink one.
   */
  mascot?: { size: number; left: number; bottom: number; first: boolean };
  /** Extra content pinned to the card's bottom-right — the streak pill. */
  badge?: ReactNode;
  /**
   * The card's height in points, declared rather than left to its contents.
   *
   * Each card carries a different amount of decoration below its row — a
   * mascot, a pill, a band of blobs — and letting content drive the height made
   * every card a different height for reasons that were invisible at the call
   * site, and made a card collapse the moment a piece of it was conditional.
   * Set it per card and the slack below the row is deliberate space for the
   * decoration to live in.
   */
  height: number;
  onPress: () => void;
  accessibilityHint: string;
}

export const ActionCard = memo(function ActionCard({
  title,
  subtitle,
  icon,
  tint,
  blobs,
  sparks = [],
  squiggle,
  mascot,
  badge,
  height,
  onPress,
  accessibilityHint,
}: ActionCardProps) {
  const revealed = useSharedValue(1);
  const well = wellFor(tint);

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityHint={accessibilityHint}
      style={[styles.card, homeShadow, { backgroundColor: tint, height }]}
    >
      {/* Decoration first so every interactive thing paints over it. */}
      {blobs.map((blob) => (
        <OrganicBlob
          key={blob.seed}
          seed={blob.seed}
          width={blob.width}
          height={blob.height}
          color={blob.color}
          x={blob.x}
          y={blob.y}
          opacity={blob.opacity ?? 1}
          initialRotation={blob.rotation ?? 0}
          revealProgress={revealed}
          zIndex={0}
          // Rounder than the auth screens' ground shapes: a high-complexity
          // silhouette clipped by a card corner reads as torn paper.
          complexity={5}
          contrast={0.18}
        />
      ))}
      {sparks.map((spark, i) => (
        <Sparks
          key={i}
          style={spark.style}
          color={spark.color}
          size={spark.size}
        />
      ))}
      {squiggle ? (
        <Squiggle style={squiggle.style} color={squiggle.color} />
      ) : null}
      {mascot ? <CardMascot {...mascot} /> : null}

      <View style={styles.row}>
        <View style={[styles.well, { backgroundColor: well }]}>
          <Icon name={icon} size={30} color={homeColors.ink} />
        </View>

        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={[styles.chevron, { backgroundColor: well }]}>
          <Icon name="arrow-right" size={22} color={homeColors.ink} />
        </View>
      </View>

      {badge ? <View style={styles.badge}>{badge}</View> : null}
    </PressableScale>
  );
});

/** The Lottie draws its character at ~45% of its square canvas. */
const CHARACTER_RATIO = 0.45;

/**
 * The card mascot, with the canvas grown around the character so the call
 * site's numbers keep meaning "where the body sits".
 */
const CardMascot = memo(function CardMascot({
  size,
  left,
  bottom,
  first,
}: NonNullable<ActionCardProps["mascot"]>) {
  const canvas = size / CHARACTER_RATIO;
  const inset = (canvas - size) / 2;
  return (
    <View
      pointerEvents="none"
      style={[styles.decor, { left: left - inset, bottom: bottom - inset }]}
    >
      <SkiaMascot
        source={HOME_BUTTON_MASCOT.source}
        inputs={{ [HOME_BUTTON_MASCOT.input]: first }}
        width={canvas}
      />
    </View>
  );
});

/** "🔥 12 day streak!" — the practice card's trailing pill. */
export const StreakPill = memo(function StreakPill({
  count,
  icon,
}: {
  count: number;
  icon: ReactNode;
}) {
  return (
    <Animated.View style={styles.pill}>
      {icon}
      <Text style={styles.pillCount}>{count}</Text>
      <Text style={styles.pillLabel}>day streak!</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: homeRadius.card,
    paddingTop: 22,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  well: {
    width: 62,
    height: 62,
    borderRadius: homeRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  title: {
    fontFamily: homeFonts.bold,
    fontSize: 21,
    letterSpacing: -0.4,
    color: homeColors.ink,
  },
  subtitle: {
    fontFamily: homeFonts.regular,
    fontSize: 15,
    lineHeight: 20,
    color: homeColors.inkSoft,
  },
  chevron: {
    width: 46,
    height: 46,
    borderRadius: homeRadius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  decor: { position: "absolute" },
  badge: { alignItems: "flex-end", marginTop: 8 },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: homeColors.cream,
    borderRadius: homeRadius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pillCount: {
    fontFamily: homeFonts.bold,
    fontSize: streakDisplay.pillCountSize,
    color: homeColors.ink,
    fontVariant: ["tabular-nums"],
  },
  pillLabel: {
    fontFamily: homeFonts.medium,
    fontSize: 14,
    color: homeColors.inkSoft,
  },
  restorePill: {
    backgroundColor: homeColors.restorePill,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  restorePillLabel: {
    color: homeColors.cream,
  },
});
