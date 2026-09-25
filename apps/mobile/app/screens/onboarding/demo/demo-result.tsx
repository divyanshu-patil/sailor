import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Host, Text as SwiftUIText } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { colord } from "colord";

import PressableScale from "@/components/ui/animated/PressableScale";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { weight } from "@/lib/haptics";
import StatusText from "@/screens/presentation/generation/preview/components/generating/components/status-text";
import { generatingMessages } from "@/screens/presentation/generation/preview/components/generating/constants";
import { getGeneratingMessages } from "@/screens/presentation/generation/preview/components/generating/utils/get-generation-messages";
import ScriptText from "@/screens/presentation/generation/preview/components/script-text/script-text";
import Card from "@/screens/presentation/generation/results/components/card";
import PracticeCard from "@/screens/presentation/script-practice/components/Card";
import DeliveryPill from "@/screens/presentation/script-practice/components/DeliveryPill";
import {
  RETURN_START_X,
  VISIBLE_COUNT,
} from "@/screens/presentation/script-practice/constants";
import { useBackgroundColorStyle } from "@/screens/presentation/script-practice/hooks/useBackgroundColorStyle";
import { useIntroAnimation } from "@/screens/presentation/script-practice/hooks/useIntroAnimation";
import { useSwipeGesture } from "@/screens/presentation/script-practice/hooks/useSwipeGesture";
import { assignImpactColors } from "@/screens/presentation/script-practice/utils/colorAssignment";
import { getCardsProgressInfoText } from "@/screens/presentation/script-practice/utils/getCardsProgressInfoText";
import {
  formatDelivery,
  getDeliveryEmoji,
} from "@/screens/presentation/script-practice/utils/getDeliveryEmoji";
import { lightenColor } from "@/screens/presentation/script-practice/utils/lightenColor";
import { PROFILE, profileFonts } from "@/screens/profile/theme";
import type { DemoDetail } from "@/services/onboarding-demo.service";
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
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: bottomInset + 24 },
      ]}
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
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: bottomInset + 24 },
      ]}
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
              <CurlArrow width={34} rotate="80deg" flip />
            </View>
            <Text style={styles.hint}>Tap your deck to open it</Text>
          </Animated.View>
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * The deck opened, presented exactly as the practice screen presents it: the
 * same card stack, swiped through with the same gesture — and so the same
 * haptic per card, graded by its impact — on the same background that takes
 * each card's colour, with the delivery pill above and the count below. Hold a
 * card to turn it over. Only the recording is left out; there is nothing to
 * record yet.
 */
export function DemoDeckViewer({
  demo,
  topInset,
  bottomInset,
  onClose,
}: {
  demo: DemoDetail;
  /** Where the screen's header ends — the pill starts below it. */
  topInset: number;
  bottomInset: number;
  onClose: () => void;
}) {
  // Edits stay in the demo: there is no deck on the server to save them to.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const cards = useMemo(
    () =>
      assignImpactColors(
        demo.deck.cards.map((card) => {
          const id = `${demo.id}-${card.position}`;
          return {
            id,
            text: edits[id] ?? card.title,
            reveal: card.description,
            color: card.color,
            impact: card.impact,
            delivery: card.delivery as Delivery,
          };
        }),
      ),
    [demo, edits],
  );
  const tiers = useMemo(() => cards.map((card) => card.tier), [cards]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexSV = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeDirection = useSharedValue<"left" | "right" | null>(null);
  const dragX = useSharedValue(0);
  const prevCardX = useSharedValue(RETURN_START_X);
  const prevCardY = useSharedValue(0);
  const prevCardOpacity = useSharedValue(0);
  const isAnimating = useSharedValue(false);
  const isRetreating = useSharedValue(false);
  const crossed = useSharedValue(false);

  const panGesture = useSwipeGesture({
    cardsLength: cards.length,
    tiers,
    currentIndexSV,
    translateX,
    translateY,
    dragX,
    swipeDirection,
    prevCardX,
    prevCardY,
    prevCardOpacity,
    isAnimating,
    isRetreating,
    crossed,
    onAdvance: () => setCurrentIndex((i) => Math.min(i + 1, cards.length)),
    onRetreat: () => setCurrentIndex((i) => Math.max(i - 1, 0)),
  });

  const screenColors = useMemo(
    () => cards.map((card) => lightenColor(card.color)),
    [cards],
  );
  const pillColors = useMemo(
    () => cards.map((card) => lightenColor(card.color, 0.1)),
    [cards],
  );
  const fallbackColor = lightenColor(demo.deck.color);
  const background = useBackgroundColorStyle({
    translateX,
    prevCardX,
    prevCardOpacity,
    swipeDirection,
    isRetreating,
    currentIndexSV,
    colors: screenColors,
    fallbackColor,
  });
  const { introRotation, introScale, introOpacity } = useIntroAnimation(true);

  // The whole view fades up over the deck page on a shared value, which can't
  // stall the way a layout entrance can.
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, { duration: 220 }));
  }, [shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));

  const current = cards[Math.min(currentIndex, cards.length - 1)];
  const delivery = current
    ? `${getDeliveryEmoji(current.delivery)} ${formatDelivery(current.delivery)}`
    : "";
  const ended = currentIndex >= cards.length;

  return (
    <Animated.View
      style={[styles.viewer, { paddingTop: topInset }, background, fade]}
    >
      <View style={[styles.pillRow, { top: topInset }]}>
        <DeliveryPill
          currentIndex={currentIndex}
          delivery={delivery}
          totalCards={cards.length}
          currentIndexSV={currentIndexSV}
          colors={pillColors}
          fallbackColor={fallbackColor}
          isRetreating={isRetreating}
          prevCardOpacity={prevCardOpacity}
          prevCardX={prevCardX}
          swipeDirection={swipeDirection}
          translateX={translateX}
        />
      </View>

      <GestureDetector gesture={panGesture}>
        <View style={styles.stack}>
          {cards.map((card, index) => {
            const depth = index - currentIndex;
            // A small window of cards around the current one, as in practice.
            if (depth < -1 || depth > VISIBLE_COUNT) return null;
            return (
              <PracticeCard
                key={card.id}
                text={card.text}
                reveal={card.reveal}
                delivery={card.delivery}
                color={card.color}
                impact={card.impact}
                index={index}
                currentIndexSV={currentIndexSV}
                zIndex={
                  depth === -1 ? VISIBLE_COUNT + 1 : VISIBLE_COUNT - depth
                }
                drag={{ translateX, translateY, swipeDirection }}
                prevDrag={{
                  translateX: prevCardX,
                  translateY: prevCardY,
                  opacity: prevCardOpacity,
                }}
                introRotation={introRotation}
                introScale={introScale}
                introOpacity={introOpacity}
                onChangeText={(text) =>
                  setEdits((all) => ({ ...all, [card.id]: text }))
                }
              />
            );
          })}
          {ended ? (
            <Text
              style={[
                styles.endText,
                { color: colord(demo.deck.color).darken(0.5).toHex() },
              ]}
            >
              {"That's the\nwhole deck"}
            </Text>
          ) : null}
        </View>
      </GestureDetector>

      <View style={[styles.viewerFoot, { paddingBottom: bottomInset }]}>
        <Host
          matchContents
          modifiers={[
            animation(Animation.spring({ bounce: 0.25 }), currentIndex),
          ]}
        >
          <SwiftUIText
            modifiers={[
              contentTransition("numericText", { countsDown: true }),
              animation(Animation.spring({ bounce: 0.25 }), currentIndex),
              font({ family: fonts.krona }),
              foregroundStyle("#d9d9d9"),
            ]}
          >
            {getCardsProgressInfoText({
              currentIndex,
              totalCards: cards.length,
            })}
          </SwiftUIText>
        </Host>
        <Text style={styles.viewerHint}>
          Swipe for the next card. Hold one to see what to say.
        </Text>
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
    paddingHorizontal: 32,
  },
  pillRow: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  stack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  endText: {
    fontSize: 34,
    lineHeight: 40,
    textAlign: "center",
    fontFamily: fonts.amarna.regular,
  },
  viewerFoot: {
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
  },
  viewerHint: {
    textAlign: "center",
    fontFamily: profileFonts.handwritten,
    fontSize: 16,
    color: "rgba(28,26,24,0.6)",
  },
  closeButton: {
    alignSelf: "stretch",
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
});
