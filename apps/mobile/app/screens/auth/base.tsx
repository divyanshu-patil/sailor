import { DotLottie } from "@lottiefiles/dotlottie-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/constants/fonts";
import { MASCOTS, MascotKey } from "@/constants/mascots";
import Svg, { Path } from "react-native-svg";

const DESIGN_WIDTH = 416;
const DESIGN_HEIGHT = 895;

const BACKGROUND = "#FBF3EA";
const INK = "#1C1A18";
const MUTED = "#8E887E";
const YELLOW = "#F4CF66";
const LIGHT_BUTTON = "#F5EDE4";
const WHITE = "#FFFFFF";

const HEADLINES = [
  { line1: "Prepare Better", line2: "Perform better." },
  { line1: "Your ideas", line2: "Your stage." },
  { line1: "Find your voice", line2: "Own the room." },
] as const;

type BlobKey = Exclude<MascotKey, "cream">;

type Layout = {
  size: number;
  top: number;
  left?: number;
  right?: number;
  zIndex: number;
};

const BLOB_LAYOUT: Record<BlobKey, Layout> = {
  green: { size: 330, top: -80, left: -90, zIndex: 2 },
  pink: { size: 350, top:10, left: -140, zIndex: 3 },
  blue: { size: 350, top: 130, left: -130, zIndex: 6 },
  orange: { size: 300, top: -10, right: -110, zIndex: 2 },
  yellow: { size: 300, top: 80, right: -110, zIndex: 3 },
  purple: { size: 300, top: 160, right: -110, zIndex: 6 },
};

function HandwrittenNote({
  children,
  style,
}: {
  children: string;
  style?: any;
}) {
  return (
      <Text
        style={[
          styles.handwritten,
          {
            fontFamily: fonts.alanSans.medium,
            color: "#9C968F",
          },
          style,
        ]}
      >
        {children}
      </Text>
  );
}

function YellowUnderline() {
  return (
    <View pointerEvents="none" style={styles.underlineWrap}>
      <View style={styles.underline} />
    </View>
  );
}

function TwoSideCurvedArrow({
  flip = false,
  style,
}: {
  flip?: boolean;
  style?: any;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: 40,
          height: 80,
        },
        style,
        flip && {
          transform: [
            ...(style?.transform ?? []),
            { scaleX: -1 },
          ],
        },
      ]}
    >
      <Svg
        width={40}
        height={80}
        viewBox="0 0 120 400"
        fill="none"
      >
        <Path
          d="M58 270 C88 244 105 210 106 169 C107 111 87 64 42 42"
          stroke="#AEB0B0"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Path
          d="M42 42L67 31 M42 42L54 65"
          stroke="#AEB0B0"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Path
          d="M58 270L58 243 M58 270L85 270"
          stroke="#AEB0B0"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function CurvedArrow({ flip = false, style }: { flip?: boolean; style?: any }) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: "absolute", width: 40, height: 40 }, flip && { transform: [{ scaleX: -1 }] }, style]}
    >
       <Svg
      width={40}
      height={80}
      viewBox="0 0 80 125"
      fill="none"
    >
      <Path
        d="
          M 11 43
          C 28 37, 44 39, 55 50
          C 68 63, 68 82, 63 103
          M 63 103
          L 52 91
          M 63 103
          L 75 92
        "
        stroke="#AEB0B0"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    </View>
  );
}

function MascotCluster({ scale }: { scale: number }) {
  const clusterWidth = DESIGN_WIDTH;
  const clusterHeight = 460;
  const creamSize = 380;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.mascotCluster,
        {
          width: clusterWidth * scale,
          height: clusterHeight * scale,
        },
      ]}
    >
      {(Object.keys(BLOB_LAYOUT) as BlobKey[]).map((key) => {
        const layout = BLOB_LAYOUT[key];
        return (
          <DotLottie
            key={key}
            source={MASCOTS[key]}
            autoplay
            loop
            style={{
              position: "absolute",
              width: layout.size * scale,
              height: layout.size * scale,
              top: layout.top * scale,
              ...(layout.left !== undefined
                ? { left: layout.left * scale }
                : { right: layout.right! * scale }),
              zIndex: layout.zIndex,
            }}
          />
        );
      })}

      <View
        style={{
          position: "absolute",
          left: -80 * scale,
          right: -80 * scale,
          top: 310 * scale,
          bottom: -400 * scale,
          backgroundColor: WHITE,
          borderTopLeftRadius: 350 * scale,
          borderTopRightRadius: 350 * scale,
          zIndex: 4,
        }}
      />

      <DotLottie
        source={MASCOTS.cream}
        autoplay
        loop
        style={{
          position: "absolute",
          width: creamSize * scale,
          height: creamSize * scale,
          left: ((DESIGN_WIDTH - creamSize) / 2) * scale,
          top: 90 * scale,
          zIndex: 10,
        }}
      />

      <View
        style={{
          position: "absolute",
          width: 180 * scale,
          height: 24 * scale,
          borderRadius: 999,
          backgroundColor: "rgba(225, 218, 207, 0.45)",
          left: ((DESIGN_WIDTH - 180) / 2) * scale,
          top: 390 * scale,
          zIndex: 9,
        }}
      />

    </View>
  );
}

function CTAButton({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: "primary" | "secondary";
  onPress: () => void;
}) {
  const primary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        primary ? styles.primaryCta : styles.secondaryCta,
        pressed && styles.ctaPressed,
      ]}
    >
      <Text
        style={[
          styles.ctaLabel,
          { color: primary ? WHITE : INK },
        ]}
      >
        {label}
      </Text>
      {primary && <Text style={styles.ctaArrow}>→</Text>}
    </Pressable>
  );
}

export default function Base() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const scale = useMemo(
    () => Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT),
    [width, height],
  );

  const canvasWidth = DESIGN_WIDTH * scale;
  const canvasHeight = DESIGN_HEIGHT * scale;
  const horizontalOffset = Math.max((width - canvasWidth) / 2, 0);
  const safeTop = Math.max(insets.top, 0);
  const topLift = Math.min(safeTop, 32);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setHeadlineIndex((previous) => (previous + 1) % HEADLINES.length);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    }, 4200);

    return () => clearInterval(interval);
  }, [contentOpacity]);

  const handleLogin = () => router.push("/(unauthenticated)/login");
  const handleSignUp = () => router.push("/(unauthenticated)/create-account");

  const current = HEADLINES[headlineIndex];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View
        style={[
          styles.canvas,
          {
            width: canvasWidth,
            height: canvasHeight,
            left: horizontalOffset,
            top: -topLift,
          },
        ]}
      >
        <HandwrittenNote style={styles.topLeftNote}>
          {"Ideas today,\nbetter\ntomorrow."}
        </HandwrittenNote>
        <CurvedArrow style={{ left: 105, top: 80 }} />

        <Animated.View style={[styles.headlineBlock, { opacity: contentOpacity }]}>
          <Text style={styles.mainHeadline}>{current.line1}</Text>
          <YellowUnderline />
          <Text style={styles.secondaryHeadline}>{current.line2}</Text>
        </Animated.View>

        <Text style={styles.description}>
          Create stunning presentations, craft compelling speeches, and practice
          with confidence all in one place.
        </Text>

        <HandwrittenNote style={styles.midRightNote}>
          {"Same you,\nBrighter\nideas."}
        </HandwrittenNote>
        <CurvedArrow flip style={{ right: 110, top: 340, left: undefined }} />

        <MascotCluster scale={scale} />

        <View style={styles.buttonStack}>
          <CTAButton
            label="Create an account"
            variant="primary"
            onPress={handleSignUp}
          />
          <CTAButton label="Log in" variant="secondary" onPress={handleLogin} />
        </View>

        <View style={styles.footerRow}>
          <HandwrittenNote style={styles.bottomRightNote}>
            {"Small steps\nbig progress."}
          </HandwrittenNote>
<TwoSideCurvedArrow
  flip
  style={{
    right: -5,
    bottom: -10,
    left: undefined,
    top: undefined,
    transform: [{ rotate: "-180deg" }],
  }}
/>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  canvas: {
    position: "absolute",
    overflow: "visible",
    backgroundColor: BACKGROUND,
  },
  handwritten: {
    position: "absolute",
    color: MUTED,
    fontSize: 13,
    lineHeight: 16,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  topLeftNote: {
    left: 25,
    top: 85,
    width: 96,
    transform: [{ rotate: "-8deg" }],
    fontSize: 15,
    lineHeight: 18,
  },
  midRightNote: {
    right: 0,
    top: 330,
    width: 96,
    transform: [{ rotate: "7deg" }],
    fontSize: 15,
    lineHeight: 18,
  },
  bottomRightNote: {
    right: 25,
    bottom: 16,
    width: 94,
    transform: [{ rotate: "-5deg" }],
    textAlign: "left",
    fontSize: 15,
    lineHeight: 18,
  },
  curvedArrow: {
    position: "absolute",
    width: 58,
    height: 58,
    left: 95,
    top: 97,
  },
  curvedArrowArc: {
    position: "absolute",
    width: 32,
    height: 32,
    top: 0,
    left: 0,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "#9C968F",
    borderBottomRightRadius: 24,
  },
  arrowHead: {
    position: "absolute",
    width: 8,
    height: 8,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "#9C968F",
    right: -1,
    bottom: -1,
    transform: [{ rotate: "25deg" }],
  },
  headlineBlock: {
    position: "absolute",
    top: 155,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  mainHeadline: {
    color: INK,
    fontFamily: fonts.alanSans.bold,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.5,
    textAlign: "center",
  },
  underlineWrap: {
    marginTop: -8,
    width: 210,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: -1,
  },
  underline: {
    width: 190,
    height: 8,
    borderRadius: 99,
    backgroundColor: YELLOW,
    transform: [{ rotate: "-1.4deg" }],
    opacity: 0.85,
  },
  secondaryHeadline: {
    color: INK,
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.85,
    textAlign: "center",
    marginTop: -2,
  },
  description: {
    position: "absolute",
    top: 250,
    left: 36,
    right: 36,
    color: "#4B4742",
    fontFamily: fonts.alanSans.medium,
    fontSize: 16.5,
    lineHeight: 23,
    letterSpacing: -0.05,
    textAlign: "center",
  },
  blueSwiggle: {
    position: "absolute",
    width: 50,
    height: 46,
    right: -2,
    top: 382,
    transform: [{ rotate: "-18deg" }],
  },
  swiggleMain: {
    position: "absolute",
    width: 37,
    height: 9,
    borderRadius: 99,
    backgroundColor: "#3A97EA",
    left: 7,
    top: 19,
    transform: [{ rotate: "-7deg" }],
  },
  swiggleTail: {
    position: "absolute",
    width: 21,
    height: 9,
    borderRadius: 99,
    backgroundColor: "#3A97EA",
    left: 22,
    top: 8,
    transform: [{ rotate: "47deg" }],
  },
  doodleAccent: {
    position: "absolute",
    borderRadius: 999,
  },
  mascotCluster: {
    position: "absolute",
    left: 0,
    top: 354,
    alignSelf: "center",
    overflow: "visible",
  },
  buttonStack: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: -10,
    gap: 10,
  },
  cta: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCta: {
    backgroundColor: INK,
  },
  secondaryCta: {
    backgroundColor: LIGHT_BUTTON,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaLabel: {
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  ctaArrow: {
    position: "absolute",
    right: 27,
    color: WHITE,
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 22,
    lineHeight: 24,
  },
  footerRow: {
    position: "absolute",
    left: 25,
    right: 18,
    bottom: 95,
    height: 45,
    justifyContent: "flex-end",
  },
  dotsRow: {
    position: "absolute",
    left: 0,
    bottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D6CEC4",
  },
  dotActive: {
    width: 16,
    backgroundColor: INK,
  },
});
