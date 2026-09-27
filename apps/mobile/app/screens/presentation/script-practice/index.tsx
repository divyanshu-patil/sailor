import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import { useLocalSearchParams } from "expo-router";
import Card from "./components/Card";
import RecordButton from "./components/RecordButton";
import { useCallback, useMemo, useState } from "react";
import Animated, {
  FadeIn,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import {
  KeyboardController,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { fonts } from "@/constants/fonts";
import { colord } from "colord";
import { Host, Text as SwiftUIText } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { assignImpactColors } from "./utils/colorAssignment";
import { useSwipeGesture } from "./hooks/useSwipeGesture";
import { useBackgroundColorStyle } from "./hooks/useBackgroundColorStyle";
import { useIntroAnimation } from "./hooks/useIntroAnimation";
import { RETURN_START_X, VISIBLE_COUNT } from "./constants";
import { getCardsProgressInfoText } from "./utils/getCardsProgressInfoText";
import { useRecordingTimer } from "./hooks/useRecordingTimer";
import { formatDelivery, getDeliveryEmoji } from "./utils/getDeliveryEmoji";
import DeliveryPill from "./components/DeliveryPill";
import { lightenColor } from "./utils/lightenColor";
import DurationText from "./components/DurationText";
import { useCards } from "@/hooks";
import SkiaMascot from "@/components/ui/skia-mascot";
import { CELEBRATION_MASCOT, NO_DECKS_MASCOT } from "@/constants/mascots";
import { LottieMascot } from "@/screens/daily-practice/components/Mascot";
type ScriptPracticeParams = {
  id: string;
  color: string;
  public?: string;
};
/**
 * Runs on the React Native JS runtime.
 *
 * This function is called from the UI thread through scheduleOnRN().
 */
const dismissKeyboard = () => {
  KeyboardController.dismiss();
};
const ScriptPracticeScreen = () => {
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<ScriptPracticeParams>();
  const {
    data: rawCards,
    isLoading: isLoadingCards,
    error: cardsError,
    saveCard,
  } = useCards({
    deckId: params.id,
    // Public decks are not stored in the user's local mirror.
    local: params.public !== "1",
    onError: () => {
      // Error is handled by the hook.
    },
  });
  const cards = useMemo(() => assignImpactColors(rawCards ?? []), [rawCards]);
  /** Impact tier per card, for the swipe handler's haptics. Same array the
   *  colours came from, so the two can't disagree. */
  const tiers = useMemo(() => cards.map((card) => card.tier), [cards]);
  const [recordingDuration, setRecordingDuration] = useState<string | null>(
    null,
  );
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const isRecording = useSharedValue(0);
  const isRecordingBool = useSharedValue(false);
  const isPaused = useSharedValue(false);
  const isStopped = useSharedValue(false);
  const { minutesTens, minutesOnes, secsTens, secsOnes } = useRecordingTimer(
    isRecordingBool,
    isPaused,
    isStopped,
  );
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
  const swipeCrossed = useSharedValue(false);
  /**
   * Keyboard visibility is used only to enable
   * the dismiss gesture.
   *
   * It is NOT used to move the screen/card.
   */
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const advanceIndex = () => {
    setCurrentIndex((i) => Math.min(i + 1, cards.length));
  };
  const retreatIndex = () => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const handleTextChange = async (cardId: string, newText: string) => {
    await saveCard(cardId, { title: newText });
  };
  /**
   * Existing card navigation gesture.
   */
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
    crossed: swipeCrossed,
    onAdvance: advanceIndex,
    onRetreat: retreatIndex,
  });
  /**
   * Full-screen keyboard dismissal gesture.
   *
   * Only reacts to a meaningful DOWNWARD swipe.
   *
   * Horizontal gestures fail this gesture, so
   * normal card navigation is unaffected.
   *
   * simultaneousWithExternalGesture() is important:
   * it allows this gesture to work even when
   * the finger starts directly on the card.
   */
  const keyboardDismissGesture = Gesture.Pan()
    .enabled(keyboardVisible)
    .minDistance(10)

    // Start recognizing when moving vertically.
    .activeOffsetY(20)

    // Don't treat horizontal card swipes
    // as keyboard dismissal.
    .failOffsetX([-25, 25])

    // Allow the existing card gesture to
    // recognize at the same time.
    .simultaneousWithExternalGesture(panGesture)

    .onEnd((event) => {
      if (event.translationY > 40) {
        scheduleOnRN(dismissKeyboard);
      }
    });
  /**
   * Background palettes.
   */
  const screenColors = useMemo(
    () => cards.map((card) => lightenColor(card.color)),
    [cards],
  );
  const pillColors = useMemo(
    () => cards.map((card) => lightenColor(card.color, 0.1)),
    [cards],
  );
  const fallbackColor = useMemo(
    () => lightenColor(params.color),
    [params.color],
  );
  const animatedScreenStyle = useBackgroundColorStyle({
    translateX,
    prevCardX,
    prevCardOpacity,
    swipeDirection,
    isRetreating,
    currentIndexSV,
    colors: screenColors,
    fallbackColor,
  });
  const { introRotation, introScale, introOpacity } = useIntroAnimation(
    !isLoadingCards && !cardsError && cards.length > 0,
  );
  /**
   * Recording timer animation.
   */
  const TIMER_TRANSLATE_Y = 100;
  const animatedTimerStyles = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withSpring(
          interpolate(isRecording.value, [0, 1], [TIMER_TRANSLATE_Y, 0]),
          {
            damping: 70,
            stiffness: 500,
          },
        ),
      },
    ],
    opacity: interpolate(isRecording.value, [0, 1], [0, 1]),
  }));
  const getDeliveryText = useCallback(
    (currIndex: number) => {
      const safeIndex = Math.min(currIndex, cards.length - 1);
      const card = cards[safeIndex];
      if (!card) {
        return "";
      }

      return `${getDeliveryEmoji(card.delivery)} ${formatDelivery(
        card.delivery,
      )}`;
    },
    [cards],
  );
  /**
   * Loading state.
   */
  if (isLoadingCards) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: headerHeight,
          },
          styles.centered,
        ]}
      >
        <ActivityIndicator />
      </View>
    );
  }

  /**
   * Empty/error state.
   */
  if (cardsError || cards.length === 0) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: headerHeight,
          },
          styles.centered,
        ]}
      >
        {!cardsError && <LottieMascot mascot={NO_DECKS_MASCOT} size={180} />}
        <Text
          style={{
            color: "#666",
          }}
        >
          {cardsError ?? "No cards in this script yet."}
        </Text>
      </View>
    );
  }

  return (
    /**
     * Full-screen detector.
     *
     * This is outside the entire screen so a
     * downward swipe can start anywhere.
     */
    <GestureDetector gesture={keyboardDismissGesture}>
      <Animated.View
        style={[
          styles.screen,
          {
            paddingTop: headerHeight,
          },
          animatedScreenStyle,
        ]}
      >
        {/* -------------------------------- */}
        {/* Delivery pill */}
        {/* -------------------------------- */}

        <View
          style={[
            styles.deliveryPillContainer,
            {
              top: headerHeight,
            },
          ]}
        >
          <DeliveryPill
            currentIndex={currentIndex}
            delivery={getDeliveryText(currentIndex)}
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

        {/* -------------------------------- */}
        {/* Card stack */}
        {/* -------------------------------- */}

        <GestureDetector gesture={panGesture}>
          <View style={styles.cardContainer}>
            {cards.map((item, index) => {
              const depth = index - currentIndex;
              /**
               * Keep a small window of cards
               * mounted around the current card.
               */
              if (depth < -1 || depth > VISIBLE_COUNT) {
                return null;
              }

              return (
                <Card
                  key={item.id}
                  text={item.text}
                  reveal={item.reveal}
                  delivery={item.delivery}
                  color={item.color}
                  impact={item.impact}
                  index={index}
                  currentIndexSV={currentIndexSV}
                  zIndex={
                    depth === -1 ? VISIBLE_COUNT + 1 : VISIBLE_COUNT - depth
                  }
                  drag={{
                    translateX,
                    translateY,
                    swipeDirection,
                  }}
                  prevDrag={{
                    translateX: prevCardX,
                    translateY: prevCardY,
                    opacity: prevCardOpacity,
                  }}
                  introRotation={introRotation}
                  introScale={introScale}
                  introOpacity={introOpacity}
                  onChangeText={(newText) => handleTextChange(item.id, newText)}
                />
              );
            })}

            {/* Mounted only once the last card is gone, so the cheer starts
                from its first frame at that moment, then loops. */}
            {currentIndex >= cards.length && (
              <SkiaMascot
                source={CELEBRATION_MASCOT.source}
                loop
                width={260}
                style={styles.celebration}
              />
            )}
            <Animated.Text
              entering={FadeIn.delay(100)}
              layout={LinearTransition.springify()}
              style={[
                styles.emptytext,
                {
                  color: colord(params.color).darken(0.5).toHex(),
                },
              ]}
            >
              Completed 🎉
            </Animated.Text>
          </View>
        </GestureDetector>

        {/* -------------------------------- */}
        {/* Bottom controls */}
        {/* -------------------------------- */}

        <View style={styles.bottomContainer}>
          <View
            style={{
              width: "100%",
              gap: 36,
              paddingBottom: 12,
              alignItems: "center",
            }}
          >
            <Host
              matchContents
              modifiers={[
                animation(
                  Animation.spring({
                    bounce: 0.25,
                  }),
                  currentIndex,
                ),
              ]}
            >
              <SwiftUIText
                modifiers={[
                  contentTransition("numericText", {
                    countsDown: true,
                  }),
                  animation(
                    Animation.spring({
                      bounce: 0.25,
                    }),
                    currentIndex,
                  ),
                  font({
                    family: fonts.krona,
                  }),
                  foregroundStyle("#d9d9d9"),
                ]}
              >
                {getCardsProgressInfoText({
                  currentIndex,
                  totalCards: cards.length,
                })}
              </SwiftUIText>
            </Host>

            <Animated.View
              style={animatedTimerStyles}
              layout={LinearTransition.springify()}
            >
              <DurationText
                currentIndex={currentIndex}
                durationInfo={{
                  minutesTens,
                  minutesOnes,
                  secsTens,
                  secsOnes,
                }}
                playbackPosition={playbackPosition}
                recordingDuration={recordingDuration}
              />
            </Animated.View>
          </View>

          {/* -------------------------------- */}
          {/* Record button */}
          {/* -------------------------------- */}

          <RecordButton
            deckId={params.id}

            syncRecording={params.public !== "1"}

            isRecordingBool={isRecordingBool}
            isRecording={isRecording}
            isPaused={isPaused}
            isStopped={isStopped}

            onRecordingFinished={(uri, seconds) => {
              const m = Math.floor(seconds / 60);
              const s = seconds % 60;
              setRecordingDuration(
                `${String(Math.floor(m / 10))}${String(m % 10)}:${String(
                  Math.floor(s / 10),
                )}${String(s % 10)}`,
              );
            }}

            onPlaybackProgress={setPlaybackPosition}

            onTrash={() => setRecordingDuration(null)}

            dragX={dragX}

            accentColor={colord(params.color)
              .darken(0.25)
              .desaturate(0.5)
              .toHex()}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
};
export default ScriptPracticeScreen;
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 28,
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  celebration: { marginBottom: -40 },
  emptytext: {
    fontSize: 36,
    fontFamily: fonts.amarna.regular,
  },
  deliveryPillContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  deliveryPill: {
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bottomContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    gap: 16,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
});
