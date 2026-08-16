import React, { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";

import { fonts } from "@/constants/fonts";
import { categoryLabel, categorySymbol } from "@/constants/deck-categories";
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
      marginHorizontal: COLUMN_GAP / 2,
      marginBottom: COLUMN_GAP,
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
  const { title: ink, accent: softInk, pill: chip } = deckCardColors(deck.color);

  return (
    <View style={[styles.card, { backgroundColor: deck.color }]}>
      <View style={styles.headRow}>
        <View style={[styles.categoryChip, { backgroundColor: chip }]}>
          <SymbolView
            name={categorySymbol(deck.category) as any}
            size={11}
            tintColor={softInk}
            fallback={<></>}
          />
          <Text style={[styles.categoryText, { color: softInk }]}>
            {categoryLabel(deck.category) || "Deck"}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: ink }]} numberOfLines={3}>
        {deck.title}
      </Text>

      {!!deck.description && (
        <Text style={[styles.description, { color: softInk }]} numberOfLines={3}>
          {deck.description}
        </Text>
      )}

      {deck.tags.length > 0 && (
        <View style={styles.tagRow}>
          {deck.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={[styles.tag, { borderColor: softInk }]}>
              <Text style={[styles.tagText, { color: softInk }]}>{tag}</Text>
            </View>
          ))}
          {deck.tags.length > 3 && (
            <Text style={[styles.tagText, { color: softInk }]}>
              +{deck.tags.length - 3}
            </Text>
          )}
        </View>
      )}

      <View style={[styles.metaRow, { borderTopColor: chip }]}>
        <Meta
          symbol="rectangle.on.rectangle"
          label={`${deck.slideCount}`}
          color={softInk}
        />
        <Meta symbol="clock" label={`${deck.durationMins}m`} color={softInk} />
        {/* Practice count is the only social-proof number on a public deck —
            there is deliberately no view count anywhere. */}
        <Meta
          symbol="flame"
          label={formatCount(deck.practiceCount)}
          color={softInk}
        />
      </View>

      <Text style={[styles.author, { color: softInk }]} numberOfLines={1}>
        by {deck.creator.name}
      </Text>
    </View>
  );
});

PublicDeckCardBody.displayName = "PublicDeckCardBody";

const Meta = ({
  symbol,
  label,
  color,
}: {
  symbol: string;
  label: string;
  color: string;
}) => (
  <View style={styles.meta}>
    <SymbolView name={symbol as any} size={12} tintColor={color} fallback={<></>} />
    <Text style={[styles.metaText, { color }]}>{label}</Text>
  </View>
);

/** 1.2k rather than 1200 — a four-digit number in a 12pt row reads as a date. */
const formatCount = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${value}`;

const styles = StyleSheet.create({
  card: {
    borderRadius: 32,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 8,
  },
  headRow: { flexDirection: "row" },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: fonts.krona,
    fontSize: 17,
    // Large type wants tighter leading and negative tracking; the body copy
    // below sits near zero. One value for both sizes is wrong for one of them.
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "500",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tagText: { fontSize: 10, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontWeight: "700" },
  author: { fontSize: 11, fontWeight: "600", opacity: 0.9 },
});
