import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import { useLocalSearchParams } from "expo-router";
import Card from "./components/Card";
import RecordButton from "./components/RecordButton";
import { useCallback, useState, useMemo } from "react";
import Animated, {
  FadeIn,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
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
import { assignColorsByQuantile } from "./utils/colorAssignment";
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

type ScriptPracticeParams = { id: string; color: string };

const ScriptPracticeScreen = () => {
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<ScriptPracticeParams>();

  const {
    data: rawCards,
    isLoading: isLoadingCards,
    error: cardsError,
  } = useCards({
    deckId: params.id,
    onError: () => {
      // Error is handled by the hook
    },
  });

  const cards = useMemo(
    () => assignColorsByQuantile(rawCards ?? []),
    [rawCards],
  );

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

  // The gesture has already moved `currentIndexSV` and reset the drag values on
  // the UI thread by the time these run; React state is catching up so the
  // non-animated chrome (progress text, delivery text, mounted card window)
  // follows. Nothing animated may be reset from here — doing so is what let a
  // render land between the index change and the reset.
  const advanceIndex = () => {
    setCurrentIndex((i) => Math.min(i + 1, cards.length));
  };

  const retreatIndex = () => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const panGesture = useSwipeGesture({
    cardsLength: cards.length,
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
    onAdvance: advanceIndex,
    onRetreat: retreatIndex,
  });

  // Palettes, not single colours: the crossfade picks its endpoints from
  // `currentIndexSV` on the UI thread, so which card is current never has to
  // travel through a React render to reach the animation.
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

  const TIMER_TRANSLATE_Y = 100;
  const animatedTimerStyles = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withSpring(
          interpolate(isRecording.value, [0, 1], [TIMER_TRANSLATE_Y, 0]),
          { damping: 70, stiffness: 500 },
        ),
      },
    ],
    opacity: interpolate(isRecording.value, [0, 1], [0, 1]),
  }));

  const getDeliveryText = useCallback(
    (currIndex: number) => {
      const safeIndex = Math.min(currIndex, cards.length - 1);
      const card = cards[safeIndex];
      if (!card) return "";
      return `${getDeliveryEmoji(card.delivery)} ${formatDelivery(card.delivery)}`;
    },
    [cards],
  );

  if (isLoadingCards) {
    return (
      <View
        style={[styles.screen, { paddingTop: headerHeight }, styles.centered]}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (cardsError || cards.length === 0) {
    return (
      <View
        style={[styles.screen, { paddingTop: headerHeight }, styles.centered]}
      >
        <Text style={{ color: "#666" }}>
          {cardsError ?? "No cards in this script yet."}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.screen, { paddingTop: headerHeight }, animatedScreenStyle]}
    >
      <View style={[styles.deliveryPillContainer, { top: headerHeight }]}>
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
      <GestureDetector gesture={panGesture}>
        <View style={styles.cardContainer}>
          {cards.map((item, index) => {
            const depth = index - currentIndex;
            // One card wider than the stack on each side: React learns about an
            // advance a frame after the UI thread does, and this keeps the card
            // entering the back of the stack already mounted when it happens.
            if (depth < -1 || depth > VISIBLE_COUNT) return null;

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
                drag={{ translateX, translateY, swipeDirection }}
                prevDrag={{
                  translateX: prevCardX,
                  translateY: prevCardY,
                  opacity: prevCardOpacity,
                }}
                introRotation={introRotation}
                introScale={introScale}
                introOpacity={introOpacity}
              />
            );
          })}
          <Animated.Text
            entering={FadeIn.delay(100)}
            style={[
              styles.emptytext,
              { color: colord(params.color).darken(0.5).toHex() },
            ]}
          >
            No Cards Left
          </Animated.Text>
        </View>
      </GestureDetector>
      <View style={[styles.bottomContainer]}>
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
              animation(Animation.spring({ bounce: 0.25 }), currentIndex),
            ]}
          >
            <SwiftUIText
              modifiers={[
                contentTransition("numericText", {
                  countsDown: true,
                }),
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
          <Animated.View
            style={[animatedTimerStyles]}
            layout={LinearTransition.springify()}
          >
            <DurationText
              currentIndex={currentIndex}
              durationInfo={{ minutesTens, minutesOnes, secsTens, secsOnes }}
              playbackPosition={playbackPosition}
              recordingDuration={recordingDuration}
            />
          </Animated.View>
        </View>

        <RecordButton
          isRecordingBool={isRecordingBool}
          isRecording={isRecording}
          isPaused={isPaused}
          isStopped={isStopped}
          onRecordingFinished={(uri, seconds) => {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            setRecordingDuration(
              `${String(Math.floor(m / 10))}${String(m % 10)}:${String(Math.floor(s / 10))}${String(s % 10)}`,
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
  );
};

export default ScriptPracticeScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 32, paddingVertical: 28 },
  cardContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptytext: { fontSize: 36, fontFamily: fonts.amarna.regular },
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
  centered: { justifyContent: "center", alignItems: "center" },
});
