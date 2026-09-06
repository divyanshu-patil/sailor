import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOutDown,
  LinearTransition,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { fonts } from "@/constants/fonts";

/** The stack gains a layer every ten cards. */
export const CARDS_PER_LAYER = 7;

/** What the design asks for on a layer arriving: a spring with only its damping
 *  named, so the rest is Reanimated's own. */
const LAYER_SPRING = 70;

/**
 * CARDS.
 *
 * The word is broken across two lines and the halves arrive from the sides they
 * end up on, with the deck sliding in under the second. The deck is as tall as
 * the number is deep: a layer per ten cards, each new one rising into the
 * bottom of the pile.
 */
export const CardsHero = memo(
  ({
    value,
    ink,
    accent,
    deck,
    gap,
  }: {
    value: number;
    /** The first half of the word. */
    ink: string;
    /** The second half. */
    accent: string;
    /** The deck itself. */
    deck: string;
    /** Shown between the plates, so the pile reads as separate cards. */
    gap: string;
  }) => {
    // Never fewer than two: one plate is not a deck, and the point of the
    // drawing is that it is one.
    const layers = Math.max(2, Math.floor(value / CARDS_PER_LAYER));

    return (
      <View style={styles.cardsRoot} pointerEvents="none">
        <Animated.Text
          entering={FadeInLeft.duration(380).delay(50)}
          layout={LinearTransition.springify()}
          style={[styles.word, { color: ink }]}
        >
          CAR
        </Animated.Text>

        <View style={styles.deckRow}>
          {/* Laid out as a column rather than placed by hand, so the pile stays
              centred on its own: a plate arriving at the bottom grows the block
              and every plate above it slides up half a step to keep the middle
              where it was. The layout animation is what makes that a move
              rather than a jump — and it only happens when one arrives. */}
          <View style={styles.deck}>
            {Array.from({ length: layers }).map((_, i) => (
              // The plate is a view of its own: an entering animation drives
              // `transform`, and would otherwise overwrite the turn and squash
              // that make a square read as a card seen at an angle.
              <Animated.View
                key={i}
                entering={FadeInDown.springify().damping(LAYER_SPRING)}
                exiting={FadeOutDown.springify().damping(LAYER_SPRING)}
                layout={LinearTransition.springify().damping(LAYER_SPRING)}
                // The pile is seen from the front, so each plate sits behind
                // the one above it and the newest — always the bottom one —
                // ends up furthest back.
                style={[{ zIndex: layers - i }, i > 0 && styles.stacked]}
              >
                <View
                  style={[
                    styles.layer,
                    { backgroundColor: deck, borderColor: gap },
                  ]}
                />
              </Animated.View>
            ))}
          </View>
          <Animated.Text
            entering={FadeInRight.duration(380).delay(50)}
            layout={LinearTransition.springify()}
            style={[styles.word, { color: accent }]}
          >
            DS
          </Animated.Text>
        </View>
      </View>
    );
  },
);
CardsHero.displayName = "CardsHero";

/** Six degrees to the minute, the way a clock is already read. */
const DEGREES_PER_MINUTE = 6;

/**
 * DURATION.
 *
 * One hand, swept straight off the live position rather than the settled one,
 * so it turns with the finger and stops only where the dial does.
 */
export const ClockHero = memo(
  ({
    raw,
    hand,
    tick,
    accent,
  }: {
    raw: SharedValue<number>;
    hand: string;
    /** The minute ring. */
    tick: string;
    /** The top of the hour. */
    accent: string;
  }) => {
    const style = useAnimatedStyle(() => ({
      transform: [{ rotate: `${raw.value * DEGREES_PER_MINUTE}deg` }],
    }));

    return (
      <View style={styles.clockRoot} pointerEvents="none">
        {FACE.map((a, i) => {
          const hour = i % 5 === 0;
          return (
            <View
              key={i}
              style={[
                styles.tick,
                hour && styles.tickHour,
                {
                  backgroundColor: i === 0 ? accent : tick,
                  opacity: i === 0 ? 1 : hour ? 0.85 : 0.35,
                  transform: [
                    { translateX: CLOCK_R * Math.sin(a) },
                    { translateY: -CLOCK_R * Math.cos(a) },
                    { rotate: `${a}rad` },
                  ],
                },
              ]}
            />
          );
        })}
        <Animated.View style={[styles.hand, style]}>
          <View style={[styles.handBar, { backgroundColor: hand }]} />
        </Animated.View>
      </View>
    );
  },
);
ClockHero.displayName = "ClockHero";

/** The plate, and how far apart consecutive ones sit. Tight, so the pile reads
 *  as a deck rather than a fan. */
const PLATE = 88;
const PLATE_STEP = 15;

const HAND = 118;
/** The clock's face: a minute ring, with the hour positions picked out and the
 *  top of the hour marked in the dial's own accent. */
const CLOCK_R = 158;
const FACE = Array.from({ length: 60 }, (_, i) => (i / 60) * Math.PI * 2);

const styles = StyleSheet.create({
  cardsRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingTop: 60,
  },
  word: {
    // Krona is wide, so the word runs smaller than a grotesque would to keep
    // three of its letters inside the card.
    fontSize: 82,
    lineHeight: 84,
    letterSpacing: -1,
    fontFamily: fonts.krona,
  },
  deckRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  // Fixed width so the row never shifts sideways as the pile grows; the height
  // is left to the plates, which is what lets it stay centred.
  deck: { width: PLATE * 1.42, alignItems: "center", justifyContent: "center" },
  // A rotated square lays out as its own box, not as the diamond it draws, so
  // the plates are pulled back onto each other by the difference.
  stacked: { marginTop: -(PLATE - PLATE_STEP) },
  layer: {
    width: PLATE,
    height: PLATE,
    borderWidth: 3,
    // Turned, then flattened — the squash has to come last, which in a
    // transform list means first.
    transform: [{ scaleY: 0.42 }, { rotate: "45deg" }],
  },
  clockRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Every mark is placed from the middle of the face, so the ring needs no
  // measuring — it is one radius and sixty angles.
  tick: { position: "absolute", width: 2.5, height: 12, borderRadius: 1.5 },
  tickHour: { width: 5, height: 24, borderRadius: 2.5 },
  // The hand turns about the middle of the panel; the bar hangs from that point
  // so the rotation has a pivot without any offset arithmetic.
  hand: { width: 2, height: HAND * 2, alignItems: "center" },
  handBar: {
    width: 15,
    height: HAND,
    borderRadius: 8,
  },
});
