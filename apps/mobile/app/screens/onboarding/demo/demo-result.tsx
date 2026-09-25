import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colord } from "colord";

import PressableScale from "@/components/ui/animated/PressableScale";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { haptics, weight } from "@/lib/haptics";
import StatusText from "@/screens/presentation/generation/preview/components/generating/components/status-text";
import { generatingMessages } from "@/screens/presentation/generation/preview/components/generating/constants";
import { getGeneratingMessages } from "@/screens/presentation/generation/preview/components/generating/utils/get-generation-messages";
import ScriptText from "@/screens/presentation/generation/preview/components/script-text/script-text";
import Card from "@/screens/presentation/generation/results/components/card";
import {
  formatDelivery,
  getDeliveryEmoji,
} from "@/screens/presentation/script-practice/utils/getDeliveryEmoji";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import type { DemoCard, DemoDetail } from "@/services/onboarding-demo.service";
import type { DeckItem } from "@/types/presentation/deck";
import type { Delivery } from "@/types/presentation/card";
import { AUDIENCE_OPTIONS } from "@/types/presentation";
import { CurlArrow } from "../components/doodles";
import { moodLabel } from "./demo-picker";

import type { DemoPhase } from "./demo-footer";

export type { DemoPhase } from "./demo-footer";

/** The preview screen's own lines, minus its opener ("Hii lol") — this is a
 *  first impression, and it's the one line that reads as a placeholder. */
export const DEMO_MESSAGES = generatingMessages.filter((m) => m !== "Hii lol");

const DECK_MESSAGES = [
  "Cutting your script into cue cards",
  "Finding the beat of each moment",
  "Marking where to slow down",
];

/** The app's one spring for new UI: damping only, Reanimated's defaults for
 *  the rest. */
const SPRING = { damping: 70 };

/** The results card's natural height: 3:4, across the screen less 80pt of
 *  padding. */
const cardHeightFor = (width: number) => ((width - 80) * 4) / 3;

/**
 * How small the results card is drawn, so title, card and hint fit above the
 * footer on this screen — nearly full size on a tall phone, smaller on a short
 * one. A transform doesn't shrink the layout box, so the deck's margins take
 * back what the scale removed.
 */
function deckScaleFor(width: number, height: number) {
  const room = height - 470;
  return Math.max(0.6, Math.min(0.9, room / cardHeightFor(width)));
}

/** The settings the script was actually made with, as chips under its title. */
function Settings({ demo }: { demo: DemoDetail }) {
  const audience =
    AUDIENCE_OPTIONS.find((a) => a.value === demo.audience)?.label ?? "General";
  return (
    <Animated.View entering={FadeInDown.duration(360)} style={styles.settings}>
      {[moodLabel(demo.mood), `${demo.durationMinutes} min`, audience].map(
        (text) => (
          <View key={text} style={styles.setting}>
            <Text style={styles.settingLabel}>{text}</Text>
          </View>
        ),
      )}
    </Animated.View>
  );
}

/**
 * The script arriving — the preview screen's own pieces (the status line and
 * the progressive script renderer), driven by the stored demo instead of a job
 * poller. The blob backdrop belongs to the demo, edge to edge behind this.
 */
export function DemoScript({
  demo,
  phase,
  bottomInset,
}: {
  demo: DemoDetail | null;
  phase: DemoPhase;
  bottomInset: number;
}) {
  const { colors } = useColors();
  const done = phase === "completed" && !!demo;
  // Memoised for the same reason the preview screen memoises it: StatusText
  // resets on every new array identity.
  const labels = useMemo(
    () =>
      done ? getGeneratingMessages("completed", demo?.title) : DEMO_MESSAGES,
    [done, demo?.title],
  );

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 24 }]}
      scrollEnabled={done}
      showsVerticalScrollIndicator={false}
    >
      <StatusText labels={labels} accentColor={colors.rust} />
      {done ? (
        <>
          <Settings demo={demo} />
          <View style={styles.script}>
            <ScriptText script={demo.script} fontSize={18} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * The deck being built from the script, then the deck itself — the results
 * screen's own card for it. Tapping it opens the cue cards inside.
 */
export function DemoDeck({
  demo,
  phase,
  bottomInset,
  onOpen,
}: {
  demo: DemoDetail;
  phase: DemoPhase;
  bottomInset: number;
  onOpen: () => void;
}) {
  const { colors } = useColors();
  const { width, height } = useWindowDimensions();
  const scale = deckScaleFor(width, height);
  const shrink = (cardHeightFor(width) * (1 - scale)) / 2;
  const done = phase === "completed";
  const labels = useMemo(
    () =>
      done
        ? getGeneratingMessages("completed", "Your Deck is Ready", null, "deck")
        : DECK_MESSAGES,
    [done],
  );
  const deck: DeckItem = useMemo(
    () => ({
      id: `demo-${demo.id}`,
      title: demo.deck.title,
      description: demo.deck.description,
      color: demo.deck.color,
      updatedAt: new Date().toISOString(),
      slideCount: demo.deck.cards.length,
      durationMins: demo.durationMinutes,
      isFavourite: false,
    }),
    [demo],
  );

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusText labels={labels} accentColor={colors.rust} />
      {done ? (
        <>
          <PressableScale
            onPress={onOpen}
            haptic={weight.press}
            transformStyle={[{ scale }]}
            style={[
              styles.deck,
              { marginTop: 8 - shrink, marginBottom: -shrink },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${demo.deck.title}`}
            accessibilityHint="Shows the cue cards in this deck"
          >
            {/* The real card, but its own link is dead here: this deck exists
                only in the demo, so the press opens it in place instead. */}
            <View pointerEvents="none" collapsable={false}>
              <Card item={deck} />
            </View>
          </PressableScale>
          <Animated.View
            entering={FadeIn.delay(650).duration(420)}
            style={styles.hintRow}
          >
            <View style={styles.hintArrow}>
              <CurlArrow width={34} rotate="200deg" flip />
            </View>
            <Text style={styles.hint}>Tap your deck to open it</Text>
          </Animated.View>
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * The deck opened: its cue cards in order, one at a time — swipe between
 * them, tap one to turn it over for what to say. The same two faces the
 * practice screen gives a card, without the recording around it.
 */
export function DemoDeckViewer({
  demo,
  topInset,
  bottomInset,
  onClose,
}: {
  demo: DemoDetail;
  /** Where the screen's header ends — the cards start below it. */
  topInset: number;
  bottomInset: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const from = deckScaleFor(width, height);
  const cards = demo.deck.cards;
  const cardWidth = Math.min(width - 76, 340);
  const gap = 14;
  const step = cardWidth + gap;
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);

  // The cards rise into place as the deck opens.
  const open = useSharedValue(0);
  useEffect(() => {
    open.value = withSpring(1, SPRING);
  }, [open]);
  const stage = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [
      { translateY: (1 - open.value) * 90 },
      { scale: from + (1 - from) * open.value },
    ],
  }));

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(180)}
      style={[styles.viewer, { paddingTop: topInset + 6 }]}
    >
      <View style={styles.viewerHead}>
        <Text style={styles.viewerTitle} numberOfLines={2}>
          {demo.deck.title}
        </Text>
        <Text style={styles.viewerCount}>{`${index + 1} of ${cards.length}`}</Text>
      </View>

      <Animated.View style={[styles.fill, styles.viewerStage, stage]}>
        <Animated.ScrollView
          horizontal
          // Its content's height, not the stage's, so the stage can centre it.
          style={styles.carousel}
          snapToInterval={step}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / step);
            if (next !== index) haptics.select();
            setIndex(next);
          }}
          contentContainerStyle={{
            gap,
            paddingHorizontal: (width - cardWidth) / 2,
            paddingVertical: 24,
          }}
        >
          {cards.map((card, i) => (
            <CueCard
              key={card.position}
              card={card}
              index={i}
              width={cardWidth}
              step={step}
              scrollX={scrollX}
            />
          ))}
        </Animated.ScrollView>
        <Text style={styles.viewerHint}>Tap a card to turn it over</Text>
      </Animated.View>

      <View style={[styles.viewerFoot, { paddingBottom: bottomInset }]}>
        <PressableScale
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
        >
          <Text style={styles.closeLabel}>Close deck</Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

function CueCard({
  card,
  index,
  width,
  step,
  scrollX,
}: {
  card: DemoCard;
  index: number;
  width: number;
  step: number;
  scrollX: SharedValue<number>;
}) {
  const [flipped, setFlipped] = useState(false);
  const turn = useSharedValue(0);
  const ink = colord(card.color).darken(0.5).toHex();
  const accent = colord(card.color).darken(0.35).desaturate(0.2).toHex();
  const pill = colord(card.color).lighten(0.08).toHex();

  // Neighbours sit a little lower, smaller and tipped away, so the one in the
  // middle reads as the card in your hand.
  const place = useAnimatedStyle(() => {
    const d = (scrollX.value - index * step) / step;
    const away = Math.min(Math.abs(d), 1);
    return {
      opacity: interpolate(away, [0, 1], [1, 0.7]),
      transform: [
        { translateY: interpolate(away, [0, 1], [0, 22]) },
        { scale: interpolate(away, [0, 1], [1, 0.9]) },
        {
          rotateZ: `${interpolate(d, [-1, 0, 1], [6, 0, -6], Extrapolation.CLAMP)}deg`,
        },
      ],
    };
  });
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${turn.value * 180}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${turn.value * 180 + 180}deg` },
    ],
  }));

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    turn.value = withSpring(next ? 1 : 0, SPRING);
    if (next) haptics.reveal();
    else haptics.conceal();
  };

  const face = [styles.face, { backgroundColor: card.color }];
  return (
    <Animated.View style={[{ width, aspectRatio: 3 / 4 }, place]}>
      <Pressable
        onPress={toggle}
        style={styles.fill}
        accessibilityRole="button"
        accessibilityLabel={flipped ? card.description : card.title}
        accessibilityHint={flipped ? "Shows the cue" : "Shows what to say"}
      >
        <Animated.View style={[face, front]}>
          <Text style={[styles.cardIndex, { color: accent }]}>
            {String(card.position).padStart(2, "0")}
          </Text>
          <Text style={[styles.cardTitle, { color: ink }]} numberOfLines={5}>
            {card.title}
          </Text>
          <View style={styles.cardFoot}>
            <View style={[styles.deliveryPill, { backgroundColor: pill }]}>
              <Text style={styles.deliveryEmoji}>
                {getDeliveryEmoji(card.delivery as Delivery)}
              </Text>
              <Text style={[styles.deliveryLabel, { color: ink }]}>
                {formatDelivery(card.delivery)}
              </Text>
            </View>
            <Ionicons name="sync" size={20} color={accent} />
          </View>
        </Animated.View>

        <Animated.View style={[face, styles.faceBack, back]}>
          <Text style={[styles.cardIndex, { color: accent }]}>What to say</Text>
          <Text style={[styles.cardBody, { color: ink }]} numberOfLines={9}>
            {card.description}
          </Text>
          {card.keywords.length ? (
            <View style={styles.keywords}>
              {card.keywords.slice(0, 3).map((word) => (
                <View
                  key={word}
                  style={[styles.keyword, { backgroundColor: pill }]}
                >
                  <Text style={[styles.keywordLabel, { color: ink }]}>
                    {word}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  settings: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  setting: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  settingLabel: {
    fontFamily: profileFonts.medium,
    fontSize: 12.5,
    color: PROFILE.ink,
  },
  script: {
    marginTop: 18,
  },
  deck: {
    alignItems: "center",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  hintArrow: {
    marginTop: -18,
  },
  hint: {
    fontFamily: profileFonts.handwritten,
    fontSize: 17,
    color: PROFILE.muted,
  },
  viewer: {
    ...StyleSheet.absoluteFill,
    // A light wash over the same backdrop — the page's own content has faded
    // out underneath — so this reads as the deck opened, not a new screen.
    backgroundColor: "rgba(255, 246, 236, 0.4)",
  },
  viewerHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 28,
    paddingTop: 10,
  },
  viewerTitle: {
    flex: 1,
    fontFamily: fonts.krona,
    fontSize: 17,
    lineHeight: 24,
    color: PROFILE.ink,
  },
  viewerCount: {
    fontFamily: profileFonts.semibold,
    fontSize: 15,
    color: PROFILE.muted,
  },
  viewerStage: {
    justifyContent: "center",
  },
  carousel: {
    flexGrow: 0,
  },
  viewerHint: {
    textAlign: "center",
    fontFamily: profileFonts.handwritten,
    fontSize: 16,
    color: PROFILE.muted,
  },
  viewerFoot: {
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  closeButton: {
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PROFILE.ink,
  },
  closeLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: PROFILE.white,
  },
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: 34,
    padding: 26,
    backfaceVisibility: "hidden",
    shadowColor: "#6B4A2A",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  faceBack: {
    justifyContent: "flex-start",
  },
  cardIndex: {
    fontFamily: profileFonts.semibold,
    fontSize: 15,
  },
  cardTitle: {
    marginTop: 18,
    fontFamily: fonts.krona,
    fontSize: 25,
    lineHeight: 33,
  },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
  },
  deliveryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  deliveryEmoji: {
    fontSize: 15,
  },
  deliveryLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 14,
    textTransform: "capitalize",
  },
  cardBody: {
    marginTop: 14,
    fontFamily: profileFonts.medium,
    fontSize: 19,
    lineHeight: 27,
  },
  keywords: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: "auto",
  },
  keyword: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  keywordLabel: {
    fontFamily: profileFonts.medium,
    fontSize: 13,
  },
});
