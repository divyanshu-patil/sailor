import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Extrapolation,
  FadeInDown,
  FadeOutUp,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { haptics } from "@/lib/haptics";
import { PROFILE, profileFonts } from "@/screens/profile/theme";

const COUNT = 12;
const STEP = (2 * Math.PI) / COUNT;
const SPRING = { damping: 70 };
const RING = "#ECE3D7";
const FADED = "#BFB6AA";

const HOURS = Array.from({ length: COUNT }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const MINUTES = Array.from({ length: COUNT }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

/** "18:05" → the dials' positions and the period. Minutes round to 5. */
export function splitTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour24 = Number.isFinite(h) ? ((h % 24) + 24) % 24 : 18;
  const minute = Number.isFinite(m) ? (Math.round(m / 5) * 5) % 60 : 0;
  return {
    hourIndex: (hour24 + 11) % 12,
    minuteIndex: minute / 5,
    period: (hour24 < 12 ? "AM" : "PM") as "AM" | "PM",
  };
}

export function joinTime(
  hourIndex: number,
  minuteIndex: number,
  period: "AM" | "PM",
) {
  const hour24 = ((hourIndex + 1) % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minuteIndex * 5).padStart(2, "0")}`;
}

type Side = "left" | "right";

/*
 * The geometry, as fractions of the ring's outer radius R. Taken from the
 * reference: the rings overlap a little at the centre, so their bands cross
 * above and below the colon — the marker sits on the upper crossing — and the
 * numbers ride an inner arc at half the radius, 30° apart.
 */
const BAND = 0.16;
const OVERLAP = 0.11;
const TEXT_RADIUS = 0.5;
/** Where the bands' midlines cross, above the centre row. */
const CROSSING = Math.sqrt(
  2 * (1 - BAND / 2) * (OVERLAP - BAND / 2) - (OVERLAP - BAND / 2) ** 2,
);

/** The angle a value sits at. Left: selection points right (0), higher values
 *  above it. Right: selection points left (π), higher values above it. */
function angleOf(side: Side, index: number, rotation: number) {
  "worklet";
  return side === "left"
    ? -index * STEP + rotation
    : Math.PI + index * STEP + rotation;
}

function indexAt(side: Side, rotation: number) {
  "worklet";
  const raw = side === "left" ? rotation / STEP : -rotation / STEP;
  return ((Math.round(raw) % COUNT) + COUNT) % COUNT;
}

function rotationFor(side: Side, index: number, near: number) {
  "worklet";
  const base = side === "left" ? index * STEP : -index * STEP;
  const turns = Math.round((near - base) / (2 * Math.PI));
  return base + turns * 2 * Math.PI;
}

/** Signed distance from the selection angle, in (-π, π]. */
function fromSelection(side: Side, angle: number) {
  "worklet";
  const d = angle - (side === "left" ? 0 : Math.PI);
  return Math.atan2(Math.sin(d), Math.cos(d));
}

const DialNumber = memo(function DialNumber({
  label,
  index,
  side,
  rotation,
  radius,
  size,
}: {
  label: string;
  index: number;
  side: Side;
  rotation: SharedValue<number>;
  radius: number;
  size: number;
}) {
  const place = useAnimatedStyle(() => {
    const a = angleOf(side, index, rotation.value);
    const d = Math.abs(fromSelection(side, a));
    return {
      opacity: interpolate(
        d,
        [0, 0.6, 1.35],
        [1, 0.62, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        { translateX: Math.cos(a) * radius },
        { translateY: Math.sin(a) * radius },
        { rotate: `${side === "left" ? a : a - Math.PI}rad` },
        { scale: interpolate(d, [0, 0.55], [1, 0.8], Extrapolation.CLAMP) },
      ],
    };
  });
  const ink = useAnimatedStyle(() => {
    const d = Math.abs(
      fromSelection(side, angleOf(side, index, rotation.value)),
    );
    return { color: interpolateColor(d, [0.08, 0.34], [PROFILE.ink, FADED]) };
  });

  return (
    <Animated.View
      style={[
        styles.number,
        {
          width: size * 1.6,
          height: size * 1.2,
          marginLeft: -size * 0.8,
          marginTop: -size * 0.6,
        },
        place,
      ]}
    >
      <Animated.Text style={[styles.numberLabel, { fontSize: size }, ink]}>
        {label}
      </Animated.Text>
    </Animated.View>
  );
});

/**
 * One dial: the ring, its numbers, and the half of the picker that turns it.
 *
 * The drag is a true rotation — the finger's angle around the dial's centre —
 * so the numbers stay under the finger whichever way it moves, and a flick
 * carries on and settles on the nearest value with the app's spring. Position
 * lives on the UI thread; JS hears only the value it lands on.
 */
const Dial = memo(function Dial({
  side,
  values,
  index,
  onChange,
  R,
  width,
  centerY,
  label,
}: {
  side: Side;
  values: string[];
  index: number;
  onChange: (index: number) => void;
  R: number;
  width: number;
  centerY: number;
  label: string;
}) {
  const cx =
    side === "left" ? width / 2 + OVERLAP * R - R : width / 2 - OVERLAP * R + R;
  const offsetX = side === "left" ? 0 : width / 2;

  const rotation = useSharedValue(rotationFor(side, index, 0));
  const target = useSharedValue(rotation.value);
  const lastAngle = useSharedValue(0);
  const lastIndex = useSharedValue(index);

  // Values set from outside — the AM/PM row never moves the dials, but a
  // restored draft or a future preset can. Skipped when the dial is already
  // headed there, so a value the dial itself reported doesn't restart it.
  useEffect(() => {
    if (indexAt(side, target.value) === index) return;
    const next = rotationFor(side, index, rotation.value);
    target.set(next);
    lastIndex.set(index);
    rotation.set(withSpring(next, SPRING));
  }, [index, side, rotation, target, lastIndex]);

  const settle = (velocity: number) => {
    "worklet";
    const projected = rotation.value + velocity * 0.12;
    const next = Math.round(projected / STEP) * STEP;
    target.set(next);
    rotation.set(withSpring(next, { ...SPRING, velocity }));
    scheduleOnRN(onChange, indexAt(side, next));
  };

  const pan = Gesture.Pan()
    .minDistance(2)
    .onBegin((e) => {
      // Catch a dial that is still coasting, like a real one under a finger.
      cancelAnimation(rotation);
      lastAngle.set(Math.atan2(e.y - centerY, e.x + offsetX - cx));
    })
    .onUpdate((e) => {
      const a = Math.atan2(e.y - centerY, e.x + offsetX - cx);
      let d = a - lastAngle.value;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      lastAngle.set(a);
      rotation.set(rotation.get() + d);
      const i = indexAt(side, rotation.value);
      if (i !== lastIndex.value) {
        lastIndex.set(i);
        haptics.select();
      }
    })
    .onEnd((e) => {
      const px = e.x + offsetX - cx;
      const py = e.y - centerY;
      // Angular velocity: the finger's velocity across the radius.
      const omega = (px * e.velocityY - py * e.velocityX) / (px * px + py * py);
      settle(Math.max(-14, Math.min(14, omega)));
    })
    .onFinalize((_, success) => {
      // A touch that never became a drag still has to land on a value.
      if (!success) settle(0);
    });

  const nudge = (delta: number) => {
    const next = (index + delta + COUNT) % COUNT;
    onChange(next);
  };

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            left: cx - R,
            top: centerY - R,
            width: R * 2,
            height: R * 2,
            borderRadius: R,
            borderWidth: BAND * R,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[styles.center, { left: cx, top: centerY }]}
      >
        {values.map((value, i) => (
          <DialNumber
            key={value}
            label={value}
            index={i}
            side={side}
            rotation={rotation}
            radius={TEXT_RADIUS * R}
            size={Math.round(0.17 * R)}
          />
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.touch, { left: offsetX, width: width / 2 }]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: values[index] }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) =>
            nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)
          }
        />
      </GestureDetector>
    </>
  );
});

/**
 * Two dials that meet in the middle: hours on the left, minutes on the right,
 * each a ring bleeding off its edge of the screen with the chosen value
 * pointing at the colon. AM / PM is the capsule above them.
 */
export default function DialTimePicker({
  value,
  onChange,
  width,
  R,
}: {
  /** Local 24h "HH:MM". */
  value: string;
  onChange: (next: string) => void;
  /** Full screen width — the dials bleed off both edges. */
  width: number;
  /** The rings' outer radius. */
  R: number;
}) {
  const { hourIndex, minuteIndex, period } = splitTime(value);
  const capsuleH = 0.46 * R;
  // The capsule tucks into the top of the rings' box, where they are still far
  // apart; the rings themselves are drawn whole below it.
  const centerY = capsuleH - 0.22 * R + R;
  const height = centerY + R;

  return (
    <GestureHandlerRootView style={{ width, height }}>
      <Dial
        side="left"
        values={HOURS}
        index={hourIndex}
        onChange={(i) => onChange(joinTime(i, minuteIndex, period))}
        R={R}
        width={width}
        centerY={centerY}
        label="Hour"
      />
      <Dial
        side="right"
        values={MINUTES}
        index={minuteIndex}
        onChange={(i) => onChange(joinTime(hourIndex, i, period))}
        R={R}
        width={width}
        centerY={centerY}
        label="Minutes"
      />

      <View
        pointerEvents="none"
        style={[
          styles.marker,
          {
            left: width / 2 - 10,
            top: centerY - CROSSING * R - 10,
          },
        ]}
      />
      <Text
        pointerEvents="none"
        style={[
          styles.colon,
          {
            fontSize: Math.round(0.15 * R),
            width: 40,
            left: width / 2 - 20,
            top: centerY - 0.12 * R,
          },
        ]}
      >
        :
      </Text>

      <PressableScale
        onPress={() =>
          onChange(
            joinTime(hourIndex, minuteIndex, period === "AM" ? "PM" : "AM"),
          )
        }
        haptic={haptics.select}
        pressedScale={0.94}
        style={[
          styles.capsule,
          {
            left: width / 2 - 0.19 * R,
            width: 0.38 * R,
            height: capsuleH,
            borderRadius: 0.19 * R,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${period}. Double-tap to switch to ${period === "AM" ? "PM" : "AM"}.`}
      >
        <Animated.View
          key={period}
          entering={FadeInDown.springify().damping(70)}
          exiting={FadeOutUp.duration(140)}
          style={styles.capsuleFace}
        >
          <Ionicons
            name={period === "AM" ? "sunny" : "moon"}
            size={Math.round(0.07 * R)}
            color={PROFILE.accentYellow}
          />
          <Text
            style={[styles.capsuleLabel, { fontSize: Math.round(0.09 * R) }]}
          >
            {period}
          </Text>
        </Animated.View>
      </PressableScale>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderColor: RING,
  },
  center: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  number: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  numberLabel: {
    fontFamily: profileFonts.display,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  touch: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  marker: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: PROFILE.accentYellow,
    transform: [{ rotate: "45deg" }],
    shadowColor: "#B8860B",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  colon: {
    position: "absolute",
    textAlign: "center",
    fontFamily: profileFonts.display,
    color: PROFILE.ink,
  },
  capsule: {
    position: "absolute",
    top: 0,
    backgroundColor: PROFILE.ink,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  capsuleFace: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  capsuleLabel: {
    fontFamily: profileFonts.semibold,
    color: PROFILE.white,
    letterSpacing: 0.5,
  },
});
