import React, { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";

import { DECK_CATEGORIES } from "@/constants/deck-categories";
import { paletteColorAt } from "@/constants/deck-palette";
import { fonts } from "@/constants/fonts";
import { deckCardColors } from "@/utils/deck-colors";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import {
  COLUMN_GAP,
  SCREEN_PADDING,
} from "@/screens/presentation/decks/components/constants";

const PRESS_SPRING = { damping: 20, stiffness: 320, mass: 0.6 };

/**
 * The quick filter above the grid.
 *
 * Duplicates the bottom toolbar's category menu on purpose: the menu is the
 * complete list for someone who knows what they want, and this is the browsable
 * version for someone who doesn't. Both write the same state.
 *
 * Each chip takes a colour from the deck palette — the same seven pastels the
 * backend picks deck colours from — so the filter row belongs to the same
 * world as the cards under it. Walking the palette in order (rather than a
 * per-category table) is what keeps neighbouring chips distinct, since the
 * palette is already ordered warm -> cool.
 */
export const CategoryChips = memo(
  ({
    selected,
    onSelect,
  }: {
    selected: string | null;
    onSelect: (value: string | null) => void;
  }) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroller}
    >
      <Chip
        label="All"
        symbol="square.grid.2x2"
        // No pastel: "All" is the absence of a filter, so giving it a colour of
        // its own would make it read as an eighth category.
        color={null}
        isActive={selected === null}
        onPress={() => onSelect(null)}
      />
      {DECK_CATEGORIES.map((category, index) => (
        <Chip
          key={category.value}
          label={category.label}
          symbol={category.symbol}
          color={paletteColorAt(index)}
          isActive={selected === category.value}
          // Tapping the active chip clears it — the same gesture that turned
          // the filter on turns it off, so there's no hunt for an "All" chip
          // that has scrolled away.
          onPress={() =>
            onSelect(selected === category.value ? null : category.value)
          }
        />
      ))}
    </ScrollView>
  ),
);

CategoryChips.displayName = "CategoryChips";

const Chip = ({
  label,
  symbol,
  color,
  isActive,
  onPress,
}: {
  label: string;
  symbol: string;
  color: string | null;
  isActive: boolean;
  onPress: () => void;
}) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.05 }],
  }));

  // Text and icon are derived from the chip's own pastel exactly as the deck
  // cards derive theirs, so a filled chip reads like a small deck card rather
  // than like a different design system.
  const ink = color ? deckCardColors(color).title : undefined;

  const content = (
    <View style={styles.chipContent}>
      <SymbolView
        name={symbol as any}
        size={13}
        tintColor={isActive ? ink : undefined}
        fallback={<></>}
      />
      <Text style={[styles.chipText, isActive && ink ? { color: ink } : null]}>
        {label}
      </Text>
    </View>
  );

  return (
    <AnimatedPressable
      style={animatedStyle}
      onPressIn={() => {
        pressed.value = withSpring(1, PRESS_SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, PRESS_SPRING);
      }}
      onPress={onPress}
    >
      {isActive && color ? (
        // The selected chip is solid, not glass: it's the one element here that
        // has to read as "on" at a glance, and a material that borrows its
        // colour from whatever scrolls behind it can't do that.
        <View style={[styles.chip, { backgroundColor: color }]}>{content}</View>
      ) : (
        <GlassView
          style={styles.chip}
          // Unselected chips still carry their pastel, just as a tint through
          // the glass — the row stays legible as a palette without eight
          // saturated pills competing with the cards.
          tintColor={color ?? undefined}
          glassEffectStyle={isLiquidGlassAvailable() ? "clear" : "none"}
        >
          {content}
        </GlassView>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  scroller: { marginBottom: 10 },
  row: {
    gap: 8,
    paddingHorizontal: COLUMN_GAP / 2,
    paddingRight: SCREEN_PADDING,
    paddingVertical: 4,
  },
  chip: {
    borderRadius: 100,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipText: {
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 13,
    letterSpacing: 0.1,
  },
});
