/* eslint-disable react-hooks/immutability */
import React, { useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Snap points — distance from the TOP of the screen
const PEEK_HEIGHT = 220; // how much sheet peeks at bottom
const SNAP_COLLAPSED = SCREEN_HEIGHT - PEEK_HEIGHT; // translateY when collapsed
const SNAP_EXPANDED = 60; // translateY when fully open (near top)
const SNAP_MID = SCREEN_HEIGHT * 0.45; // half-open

interface BottomSheetProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  children,
  backgroundColor = "#C8C5F0", // the soft purple from your screenshot
}) => {
  const translateY = useSharedValue(SNAP_COLLAPSED);
  const context = useSharedValue({ y: 0 });

  const scrollTo = useCallback((destination: number) => {
    "worklet";
    translateY.value = withSpring(destination, {
      damping: 50,
      stiffness: 280,
      mass: 0.8,
    });
  }, []);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value.y = translateY.value;
    })
    .onUpdate((event) => {
      // Follow finger, clamped so it can't go above SNAP_EXPANDED
      translateY.value = Math.max(
        SNAP_EXPANDED,
        context.value.y + event.translationY,
      );
    })
    .onEnd((event) => {
      if (event.velocityY < -800 || translateY.value < SNAP_MID - 60) {
        scrollTo(SNAP_EXPANDED); // fast swipe up → full screen
      } else if (event.velocityY > 800 || translateY.value > SNAP_MID + 60) {
        scrollTo(SNAP_COLLAPSED); // fast swipe down → collapsed peek
      } else {
        scrollTo(SNAP_MID); // slow drag in middle → mid snap
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Dim the screen as the sheet rises
  const backdropOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [SNAP_COLLAPSED, SNAP_EXPANDED],
      [0, 0.35],
      Extrapolation.CLAMP,
    ),
    // Only block touches when sheet is up
    pointerEvents: translateY.value < SNAP_COLLAPSED - 10 ? "auto" : "none",
  }));

  return (
    <>
      {/* Scrim */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropOpacity]}
      />

      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor, height: SCREEN_HEIGHT },
            sheetStyle,
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* "Script" label */}
          <Text style={styles.sheetTitle}>Script</Text>

          {/* Scrollable card area */}
          <View style={styles.card}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "#000",
    zIndex: 10,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0, // translateY moves it down from top
    zIndex: 11,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
    paddingHorizontal: 20,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9E9BC8", // slightly darker than sheet bg
  },
  sheetTitle: {
    fontSize: 28,
    fontFamily: "KronaOne",
    color: "#3D3A6B",
    marginBottom: 16,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#B5B2E8", // slightly deeper purple card
    borderRadius: 24,
    padding: 20,
    minHeight: 140,
  },
});

export default BottomSheet;
