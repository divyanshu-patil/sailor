import { StyleSheet, Text, View } from "react-native";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import { useLocalSearchParams } from "expo-router";
import { dummyScriptCards } from "./dummy";
import Card from "./components/Card";
import RecordButton from "./components/RecordButton";
import { useState } from "react";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import { fonts } from "@/constants/fonts";
import { colord } from "colord";
import { Host, HStack, Text as SwiftUIText } from "@expo/ui/swift-ui";
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
import {
  deliveryModifier,
  digitModifiers,
  RETURN_START_X,
  SCREEN_WIDTH,
  separatorModifiers,
  staticModifiers,
  VISIBLE_COUNT,
} from "./constants";
import { getCardsProgressInfoText } from "./utils/getCardsProgressInfoText";
import { useRecordingTimer } from "./hooks/useRecordingTimer";
import { getDeliveryEmoji } from "./utils/getDeliveryEmoji";

type ScriptPracticeParams = { id: string; color: string };

const lightenColor = (hex: string, threshold = 0.15) =>
  colord(hex).lighten(threshold).toHex();

const ScriptPracticeScreen = () => {
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<ScriptPracticeParams>();

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

  const [cards] = useState(() => assignColorsByQuantile(dummyScriptCards));
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexSV = useSharedValue(0);

  const containerHeight = useSharedValue(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeDirection = useSharedValue<"left" | "right" | null>(null);
  const dragX = useSharedValue(0);

  const prevCardX = useSharedValue(RETURN_START_X);
  const prevCardY = useSharedValue(0);
  const prevCardOpacity = useSharedValue(0);

  const isAnimating = useSharedValue(false);
  const isRetreating = useSharedValue(false);

  const advanceIndex = () => {
    setCurrentIndex((i) => {
      const next = Math.min(i + 1, cards.length);
      currentIndexSV.value = next;
      return next;
    });
    requestAnimationFrame(() => {
      translateX.value = 0;
      translateY.value = 0;
      isAnimating.value = false;
    });
  };

  const retreatIndex = () => {
    setCurrentIndex((i) => {
      const next = Math.max(i - 1, 0);
      currentIndexSV.value = next;
      return next;
    });
    requestAnimationFrame(() => {
      prevCardX.value = RETURN_START_X;
      prevCardY.value = 0;
      prevCardOpacity.value = 0;
      isAnimating.value = false;
      isRetreating.value = false;
    });
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

  const isExhausted = currentIndex >= cards.length;

  const currentColor = isExhausted
    ? lightenColor(params.color)
    : lightenColor(cards[currentIndex].color);

  const nextColor =
    !isExhausted && currentIndex + 1 < cards.length
      ? lightenColor(cards[currentIndex + 1].color)
      : lightenColor(params.color);

  const prevColor =
    currentIndex - 1 >= 0 && currentIndex - 1 < cards.length
      ? lightenColor(cards[currentIndex - 1].color)
      : currentColor;

  const animatedScreenStyle = useBackgroundColorStyle({
    translateX,
    prevCardX,
    prevCardOpacity,
    swipeDirection,
    isRetreating,
    currentColor,
    nextColor,
    prevColor,
  });

  const pillCurrentColor = isExhausted
    ? lightenColor(params.color)
    : lightenColor(cards[currentIndex].color, 0.1);

  const pillNextColor =
    !isExhausted && currentIndex + 1 < cards.length
      ? lightenColor(cards[currentIndex + 1].color, 0.1)
      : lightenColor(params.color);

  const pillPrevColor =
    currentIndex - 1 >= 0 && currentIndex - 1 < cards.length
      ? lightenColor(cards[currentIndex - 1].color, 0.1)
      : currentColor;

  const animatedPillColorStyle = useBackgroundColorStyle({
    translateX,
    prevCardX,
    prevCardOpacity,
    swipeDirection,
    isRetreating,
    currentColor: pillCurrentColor,
    nextColor: pillNextColor,
    prevColor: pillPrevColor,
  });

  const { introRotation, introScale } = useIntroAnimation();

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

  const getDeliveryText = (currIndex: number) => {
    if (currentIndex < cards.length) {
      return `${getDeliveryEmoji(cards[currentIndex].delivery)} ${cards[currentIndex].delivery}`;
    }
    const dummyIndex = cards.length - 1;
    return `${getDeliveryEmoji(cards[dummyIndex].delivery)} ${cards[dummyIndex].delivery}`;
  };
  const animatedPillOpacityStyle = useAnimatedStyle(() => {
    // Fully exhausted and not retreating back — keep hidden
    if (isExhausted && prevCardX.value >= RETURN_START_X) return { opacity: 0 };

    // Not on last card — always visible
    if (currentIndex < cards.length - 1) return { opacity: 1 };

    if (isExhausted) {
      // Past the end — fade IN as user swipes left (retreating back to last card)
      return {
        opacity: interpolate(
          prevCardX.value,
          [RETURN_START_X, RETURN_START_X * 0.6],
          [0, 1],
          Extrapolation.CLAMP,
        ),
      };
    }

    // On last card — fade OUT as user swipes right
    return {
      opacity: interpolate(
        translateX.value,
        [0, SCREEN_WIDTH * 0.4],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <Animated.View
      style={[styles.screen, { paddingTop: headerHeight }, animatedScreenStyle]}
    >
      <View style={[styles.deliveryPillContainer, { top: headerHeight }]}>
        <Animated.View
          style={[
            styles.deliveryPill,
            animatedPillColorStyle,
            animatedPillOpacityStyle,
          ]}
        >
          <Host matchContents>
            <SwiftUIText modifiers={deliveryModifier(currentIndex)}>
              {getDeliveryText(currentIndex)}
            </SwiftUIText>
          </Host>
        </Animated.View>
      </View>
      <GestureDetector gesture={panGesture}>
        <View style={styles.cardContainer}>
          {cards.map((item, index) => {
            const depth = index - currentIndex;
            const isVisible = depth >= 0 && depth < VISIBLE_COUNT;
            const isPrev = depth === -1;
            if (!isVisible && !isPrev) return null;

            return (
              <Card
                key={item.id}
                text={item.text}
                reveal={item.reveal}
                delivery={item.delivery}
                color={item.color}
                impact={item.impact}
                currIndex={depth}
                numOfCards={VISIBLE_COUNT}
                drag={{ translateX, translateY, swipeDirection }}
                prevDrag={{
                  translateX: prevCardX,
                  translateY: prevCardY,
                  opacity: prevCardOpacity,
                }}
                introRotation={introRotation}
                introScale={introScale}
              />
            );
          })}
          <Text
            style={[
              styles.emptytext,
              { color: colord(params.color).darken(0.5).toHex() },
            ]}
          >
            No Cards Left
          </Text>
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
            onLayout={(e) => {
              containerHeight.value = e.nativeEvent.layout.height;
            }}
          >
            <Host
              matchContents
              modifiers={[
                animation(Animation.spring({ bounce: 0.25 }), currentIndex),
              ]}
            >
              <HStack spacing={0}>
                {recordingDuration ? (
                  // Playback mode: "00:13 / 01:47"
                  <>
                    {/* Current position */}
                    <SwiftUIText
                      modifiers={digitModifiers(
                        Math.floor(playbackPosition / 60 / 10),
                      )}
                    >
                      {String(
                        Math.floor(Math.floor(playbackPosition / 60) / 10),
                      )}
                    </SwiftUIText>
                    <SwiftUIText
                      modifiers={digitModifiers(
                        Math.floor(playbackPosition / 60) % 10,
                      )}
                    >
                      {String(Math.floor(playbackPosition / 60) % 10)}
                    </SwiftUIText>
                    <SwiftUIText modifiers={separatorModifiers}>:</SwiftUIText>
                    <SwiftUIText
                      modifiers={digitModifiers(
                        Math.floor((playbackPosition % 60) / 10),
                      )}
                    >
                      {String(Math.floor((playbackPosition % 60) / 10))}
                    </SwiftUIText>
                    <SwiftUIText
                      modifiers={digitModifiers(
                        Math.floor(playbackPosition % 60) % 10,
                      )}
                    >
                      {String(Math.floor(playbackPosition % 60) % 10)}
                    </SwiftUIText>

                    <SwiftUIText modifiers={separatorModifiers}>
                      {" "}
                      /{" "}
                    </SwiftUIText>

                    {/* Total duration — static, no transition needed */}
                    <SwiftUIText modifiers={staticModifiers}>
                      {recordingDuration}
                    </SwiftUIText>
                  </>
                ) : (
                  // Recording mode: "01:47"
                  <>
                    <SwiftUIText
                      modifiers={digitModifiers(Number(minutesTens))}
                    >
                      {minutesTens}
                    </SwiftUIText>
                    <SwiftUIText
                      modifiers={digitModifiers(Number(minutesOnes))}
                    >
                      {minutesOnes}
                    </SwiftUIText>
                    <SwiftUIText modifiers={separatorModifiers}>:</SwiftUIText>
                    <SwiftUIText modifiers={digitModifiers(Number(secsTens))}>
                      {secsTens}
                    </SwiftUIText>
                    <SwiftUIText modifiers={digitModifiers(Number(secsOnes))}>
                      {secsOnes}
                    </SwiftUIText>
                  </>
                )}
              </HStack>
            </Host>
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
});
