import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import { useLocalSearchParams } from "expo-router";
import { dummyScriptCards } from "./dummy";
import Card from "./components/Card";
import RecordButton from "./components/RecordButton";
import { useState } from "react";
import {
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SpringConfig } from "react-native-reanimated/lib/typescript/animation/spring";
import { scheduleOnRN } from "react-native-worklets";
import { fonts } from "@/constants/fonts";
import { colord } from "colord";

type ScriptPracticeParams = { id: string; color: string };

const IMPACT_PALETTES = [
  ["#C9E4DE", "#B8E0D2", "#CDE7E0", "#D6EAE3"],
  ["#A0D2DB", "#B5E2EE", "#C2E7F0", "#AED9E0"],
  ["#FFE8B6", "#FFEFC3", "#FCE8A6", "#FFE5A0"],
  ["#FFC8A2", "#FFD3B0", "#FFCBA4", "#FCC9A6"],
  ["#F7A7A6", "#F8B4B3", "#F9ACAB", "#F6A0A3"],
];

const assignColorsByQuantile = (cards: typeof dummyScriptCards) => {
  const sorted = [...cards].sort((a, b) => a.impact - b.impact);
  const bucketSize = Math.ceil(sorted.length / 5);
  const colorById = new Map<string, string>();
  sorted.forEach((card, i) => {
    const bucketIndex = Math.min(Math.floor(i / bucketSize), 4);
    const palette = IMPACT_PALETTES[bucketIndex];
    colorById.set(card.id, palette[Math.floor(Math.random() * palette.length)]);
  });
  return cards.map((card) => ({ ...card, color: colorById.get(card.id)! }));
};

const SETTLE_SPRING: SpringConfig = { damping: 70, mass: 1 };
const RIGHT_SWIPE_THRESHOLD = 120;
const LEFT_SWIPE_THRESHOLD = 250;
const SCREEN_WIDTH = Dimensions.get("window").width;
const RETURN_START_X = SCREEN_WIDTH * 1.5;
const VISIBLE_COUNT = 4;

const ScriptPracticeScreen = () => {
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<ScriptPracticeParams>();

  const [cards] = useState(() => assignColorsByQuantile(dummyScriptCards));
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexSV = useSharedValue(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeDirection = useSharedValue<"left" | "right" | null>(null);

  const prevCardX = useSharedValue(RETURN_START_X);
  const prevCardY = useSharedValue(0);
  const prevCardOpacity = useSharedValue(0);

  const isAnimating = useSharedValue(false);

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
      prevCardX.value = withSpring(RETURN_START_X, SETTLE_SPRING);
      prevCardY.value = 0;
      prevCardOpacity.value = 0;
      prevCardX.value = RETURN_START_X;
      prevCardY.value = 0;
      isAnimating.value = false;
    });
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (isAnimating.value) return;
      if (e.translationX >= 0) {
        swipeDirection.value = "right";
        translateX.value = e.translationX;
        translateY.value = e.translationY;
        prevCardOpacity.value = withTiming(0, { duration: 80 });
        prevCardX.value = RETURN_START_X;
      } else {
        swipeDirection.value = "left";
        translateX.value = e.translationX;
        translateY.value = 0;

        if (currentIndexSV.value > 0) {
          const progress = Math.abs(e.translationX) / LEFT_SWIPE_THRESHOLD;
          const clampedProgress = Math.min(progress, 1);
          prevCardX.value =
            RETURN_START_X * (1 - clampedProgress) -
            Math.max(0, progress - 1) * 40;
          prevCardOpacity.value = clampedProgress;
          prevCardY.value = (clampedProgress - 1) * 50;
        }
      }
    })
    .onEnd((e) => {
      if (isAnimating.value) return;
      if (swipeDirection.value === "right") {
        if (
          translateX.value > RIGHT_SWIPE_THRESHOLD &&
          currentIndexSV.value < cards.length
        ) {
          isAnimating.value = true;
          translateX.value = withTiming(
            SCREEN_WIDTH * 1.5,
            { duration: 250 },
            (finished) => {
              if (finished) scheduleOnRN(advanceIndex);
            },
          );
        } else {
          translateX.value = withSpring(0, SETTLE_SPRING);
          translateY.value = withSpring(0, SETTLE_SPRING);
          prevCardOpacity.value = withTiming(0, { duration: 120 });
        }
      } else if (swipeDirection.value === "left") {
        const didExceedThreshold =
          Math.abs(e.translationX) > LEFT_SWIPE_THRESHOLD &&
          currentIndexSV.value > 0;

        if (didExceedThreshold) {
          isAnimating.value = true;
          prevCardX.value = withSpring(
            0,
            { damping: 22, stiffness: 250, mass: 0.6 },
            (finished) => {
              if (finished) scheduleOnRN(retreatIndex);
            },
          );
          prevCardY.value = withSpring(0, {
            damping: 22,
            stiffness: 250,
            mass: 0.6,
          });
          prevCardOpacity.value = 1;
        } else {
          translateX.value = withSpring(0, SETTLE_SPRING);
          translateY.value = withSpring(0, SETTLE_SPRING);
          prevCardX.value = withSpring(RETURN_START_X, {
            damping: 22,
            stiffness: 250,
          });
          prevCardOpacity.value = withTiming(0, { duration: 100 });
        }
      }

      swipeDirection.value = null;
    });

  return (
    <View style={[styles.screen, { paddingTop: headerHeight }]}>
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
      <View>
        <RecordButton accentColor={"#7B75E0"} />
      </View>
    </View>
  );
};

export default ScriptPracticeScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 32, paddingVertical: 28 },
  cardContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptytext: { fontSize: 36, fontFamily: fonts.amarna.regular },
});
