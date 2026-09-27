import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import CtaButton from "../../../components/cta-button";
import { GenerationState } from "../../../../hooks/use-script-generation";
import SkiaMascot from "@/components/ui/skia-mascot";
import { TIP_MASCOT } from "@/constants/mascots";
import { tipFor } from "@/constants/tips";
import { fonts } from "@/constants/fonts";
import { DAILY_SPRING } from "@/screens/daily-practice/theme";

const MASCOT_SIZE = 200;
const MASCOT_RIGHT = 12;
const MASCOT_BOTTOM = 230;

interface GeneratingScreenProps {
  status: GenerationState;
  error?: string | null;
  onStop: () => void;
  /** Re-run the job. Omitted where there's nothing sensible to retry. */
  onRetry?: () => void;
  /** Picks the tip. The generation's id, so reopening it shows the same one;
   *  no tip until it's known. */
  seed?: string | null;
}

/**
 * The overlay shown while a job runs, and after it stops.
 *
 * "failed" and "cancelled" are terminal, but used to render the same Stop button
 * as a running job — so a job that had already died was indistinguishable from
 * one still working, and the only thing on offer was to stop something already
 * stopped. Both now offer Try again, which is the only action that means
 * anything from either state.
 *
 * The mascot slides in from off the right edge once its file has loaded, and
 * the tip pops in beside it when it lands. A failed or stopped job switches
 * the mascot to its error pose and takes the tip away.
 */
const GeneratingScreen = ({
  onStop,
  onRetry,
  status,
  seed,
}: GeneratingScreenProps) => {
  const isTerminal = status === "failed" || status === "cancelled";
  const tip = seed ? tipFor(seed) : null;

  // 1 = parked just past the right edge, 0 = in place.
  const slide = useSharedValue(1);
  const tipIn = useSharedValue(0);
  const float = useSharedValue(0);
  const [landed, setLanded] = useState(false);

  const onMascotLoad = useCallback(() => {
    slide.set(withSpring(0, DAILY_SPRING));
  }, [slide]);

  // DAILY_SPRING is overdamped: ~0.8s to cover 70% of the slide, ~2s more
  // to creep the rest. The tip comes in over that tail instead of after it.
  useAnimatedReaction(
    () => slide.get() < 0.3,
    (now, before) => {
      if (now && !before) scheduleOnRN(setLanded, true);
    },
  );

  const showTip = landed && !isTerminal && !!tip;
  useEffect(() => {
    tipIn.set(
      withTiming(showTip ? 1 : 0, {
        duration: showTip ? 320 : 220,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [showTip, tipIn]);

  useEffect(() => {
    float.set(
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [float]);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.get() * (MASCOT_SIZE + MASCOT_RIGHT) }],
  }));

  const tipStyle = useAnimatedStyle(() => ({
    opacity: tipIn.get(),
    transform: [
      { translateY: -4 * float.get() },
      { scale: 0.85 + 0.15 * tipIn.get() },
    ],
    // Grows out of the corner that points at the mascot.
    transformOrigin: ["100%", "100%", 0],
  }));

  if (status === "completed") return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[styles.bubble, tipStyle]}>
        <Text style={styles.tipText}>{tip}</Text>
      </Animated.View>

      <Animated.View style={[styles.mascot, mascotStyle]}>
        <SkiaMascot
          source={TIP_MASCOT.source}
          inputs={{ [TIP_MASCOT.input]: isTerminal }}
          // The file's states are one-shots; the tip pose loops while it waits.
          loop={!isTerminal}
          width={MASCOT_SIZE}
          onLoad={onMascotLoad}
        />
      </Animated.View>

      <CtaButton
        containerStyles={styles.ctaStyle}
        onPress={isTerminal ? (onRetry ?? onStop) : onStop}
      >
        {isTerminal ? "Try again" : "Stop"}
      </CtaButton>
    </View>
  );
};

export default GeneratingScreen;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "flex-start",
  },
  mascot: {
    position: "absolute",
    right: MASCOT_RIGHT,
    bottom: MASCOT_BOTTOM,
  },
  bubble: {
    position: "absolute",
    right: MASCOT_RIGHT + MASCOT_SIZE * 0.35,
    bottom: MASCOT_BOTTOM + MASCOT_SIZE * 0.95,
    maxWidth: "70%",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderRadius: 32,
    borderBottomRightRadius: 0,
  },
  tipText: {
    fontFamily: fonts.krona,
    fontSize: 17,
    lineHeight: 24,
    color: "#111",
  },
  ctaStyle: {
    position: "absolute",
    bottom: 20,
    left: 20,
  },
});
