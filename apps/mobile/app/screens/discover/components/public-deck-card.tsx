import React, { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { Link } from "expo-router";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";

import { fonts } from "@/constants/fonts";
import { categoryLabel } from "@/constants/deck-categories";
import { PublicDeck } from "@/services/public-deck.service";
import { deckCardColors } from "@/utils/deck-colors";
import { COLUMN_GAP } from "@/screens/presentation/decks/components/constants";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";

/**
 * Two springs, two jobs.
 *
 * ENTRY is momentum-free — a card that merely appeared shouldn't overshoot — so
 * it's critically damped. PRESS is touch-down feedback: it starts on the press
 * rather than the release, and because it's a spring it retargets from wherever
 * the scale currently is when the finger lifts mid-animation, instead of
 * snapping back to the start of a fixed timing curve.
 */
const ENTRY_SPRING = { damping: 26, stiffness: 190, mass: 0.9 };
const PRESS_SPRING = { damping: 20, stiffness: 320, mass: 0.6 };

/** Wrap the stagger so a card 40 rows down doesn't animate two seconds late. */
const STAGGER_MS = 45;
const STAGGER_CYCLE = 6;

export const PublicDeckCard = memo(
  ({ deck, index }: { deck: PublicDeck; index: number }) => {
    const enter = useSharedValue(0);
    const pressed = useSharedValue(0);

    useEffect(() => {
      const delay = (index % STAGGER_CYCLE) * STAGGER_MS;
      enter.value = withDelay(delay, withSpring(1, ENTRY_SPRING));
    }, [enter, index]);

    // The layout margins live *inside* the animated style rather than beside it
    // in an array. `Link asChild` clones its child through a Slot, which flattens
    // one style prop onto the pressable and warns on an array — so this has to
    // be a single object, the same way the deck-grid card does it.
    const animatedStyle = useAnimatedStyle(() => ({
      marginBottom: COLUMN_GAP + 2,
      opacity: enter.value,
      transform: [
        { translateY: (1 - enter.value) * 22 },
        { scale: 0.94 + enter.value * 0.06 - pressed.value * 0.04 },
      ],
    }));

    return (
      <Link
        // Everything the detail screen paints before its own fetch lands, so
        // the zoom transition arrives on a finished card rather than a blank
        // one. `public: "1"` is what tells that screen it isn't yours.
        href={{
          pathname: "/(authenticated)/discover/[id]",
          params: {
            id: deck.id,
            title: deck.title,
            description: deck.description,
            color: deck.color,
            updatedAt: deck.publishedAt ?? "",
            slideCount: String(deck.slideCount),
            durationMins: String(deck.durationMins),
            isFavourite: "false",
            public: "1",
          },
        }}
        asChild
      >
        <Link.AppleZoom>
          <AnimatedPressable
            style={animatedStyle}
            // Feedback on press-down, not on release: waiting for the tap to
            // commit is what makes a card feel dead under the finger.
            onPressIn={() => {
              pressed.value = withSpring(1, PRESS_SPRING);
            }}
            onPressOut={() => {
              pressed.value = withSpring(0, PRESS_SPRING);
            }}
          >
            <PublicDeckCardBody deck={deck} />
          </AnimatedPressable>
        </Link.AppleZoom>
      </Link>
    );
  },
);

PublicDeckCard.displayName = "PublicDeckCard";

/**
 * The card itself, with no tap target and no entrance animation.
 *
 * The publish review sheet renders this so the author sees the *actual* feed
 * card before committing — a hand-built approximation would be a promise the
 * feed stops keeping the moment either one is restyled.
 */
export const PublicDeckCardBody = memo(({ deck }: { deck: PublicDeck }) => {
  // The same derivations the deck-grid card uses, off the author's own colour —
  // a deck looks identical whether you meet it in your library or the feed.
  const {
    title: ink,
    accent: softInk,
    pill: chip,
  } = deckCardColors(deck.color);

  return (
    <View style={[styles.card, { backgroundColor: deck.color }]}>
      {/* Left: who and what kind. Only the category and the tags wear a pill —
          names and copy are plain text, so the pills stay a signal for the two
          things that are actually filterable. */}
      <View style={styles.left}>
        <View style={styles.leftTop}>
          <View style={[styles.categoryChip, { backgroundColor: chip }]}>
            <Text style={[styles.categoryText, { color: softInk }]}>
              {categoryLabel(deck.category) || "Deck"}
            </Text>
          </View>

          <View style={styles.authorRow}>
            <View style={[styles.avatar, { backgroundColor: chip }]}>
              <MaterialDesignIcons name="account" size={20} color={ink} />
            </View>
            <Text style={[styles.author, { color: softInk }]} numberOfLines={1}>
              {deck.creator.name}
            </Text>
          </View>

          {deck.tags.length > 0 && (
            <View style={styles.tagRow}>
              {deck.tags.slice(0, 4).map((tag) => (
                <View key={tag} style={[styles.tag, { borderColor: softInk }]}>
                  <Text style={[styles.tagText, { color: softInk }]}>
                    {tag}
                  </Text>
                </View>
              ))}
              {deck.tags.length > 4 && (
                <Text style={[styles.tagText, { color: softInk }]}>
                  +{deck.tags.length - 4}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* The same cards-and-count pill the library grid uses, so a deck's
            slide count looks the same wherever you meet it. */}
        <View style={[styles.countPill, { backgroundColor: chip }]}>
          <MaterialDesignIcons name="cards-playing" size={22} color={softInk} />
          <Text style={[styles.countText, { color: softInk }]}>
            {deck.slideCount}
          </Text>
        </View>
      </View>

      {/* Right: the deck itself, on a lighter plate of the same hue. It runs to
          the card's top, right and bottom edges — the card's own overflow
          clipping is what rounds the outer corners. */}
      <View style={[styles.right, { backgroundColor: chip }]}>
        <Text style={[styles.title, { color: ink }]} numberOfLines={2}>
          {deck.title}
        </Text>

        {!!deck.description && (
          <Text
            style={[styles.description, { color: softInk }]}
            numberOfLines={3}
          >
            {deck.description}
          </Text>
        )}

        <View style={styles.rightFooter}>
          {/* Practice count is the only social-proof number on a public deck —
              there is deliberately no view count anywhere. */}
          <View style={styles.meta}>
            <MaterialDesignIcons name="fire" size={22} color={softInk} />
            <Text style={[styles.metaText, { color: softInk }]}>
              {formatCount(deck.practiceCount)}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: softInk }]}>
            {deck.durationMins}m
          </Text>
        </View>
      </View>
    </View>
  );
});

PublicDeckCardBody.displayName = "PublicDeckCardBody";

/** 1.2k rather than 1200 — a four-digit number in a 12pt row reads as a date. */
const formatCount = (value: number): string =>
  value >= 1000
    ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`
    : `${value}`;

const styles = StyleSheet.create({
  card: {
    borderRadius: 34,
    // Clips the right-hand plate's outer corners to the card's own radius, which
    // is what lets that plate run edge to edge instead of floating inside a
    // padding gutter.
    overflow: "hidden",
    flexDirection: "row",
    minHeight: 224,
  },
  left: {
    flex: 4,
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 12,
    paddingTop: 20,
    paddingBottom: 18,
  },
  leftTop: { gap: 12 },
  right: {
    flex: 5,
    // Only the inner corners are rounded; the card clips the outer three.
    borderTopLeftRadius: 34,
    borderBottomLeftRadius: 34,
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: "space-between",
    gap: 10,
  },
  categoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  author: { flex: 1, fontSize: 13, fontWeight: "600" },
  title: {
    fontFamily: fonts.krona,
    fontSize: 18,
    // Large type wants tighter leading and negative tracking; the body copy
    // below sits near zero. One value for both sizes is wrong for one of them.
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  description: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tagText: { fontSize: 11, fontWeight: "600" },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  countText: { fontSize: 20, fontWeight: "700" },
  rightFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    justifyContent: "flex-end",
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 20, fontWeight: "700" },
});
