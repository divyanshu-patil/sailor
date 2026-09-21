import {
  Stack,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { weight } from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { fonts } from "@/constants/fonts";
import { CREAM_MASCOT_STATES, MASCOTS, MascotKey } from "@/constants/mascots";
import Svg, { Path } from "react-native-svg";
import AnimatedOrganicGround from "@/components/ui/animated-organic-ground";
import AnimatedMascot from "@/components/ui/animated-mascot";
import OrganicBlob from "@/components/ui/organic-blob";
import { CreateAccountPanel } from "@/screens/auth/components/create-account-panel";
import { MorphArrow } from "@/screens/auth/components/morph-arrow";
import {
  MorphDescription,
  MorphHeadline,
  MorphNote,
} from "@/screens/auth/components/morph-text";
import { useCreateAccountTransition } from "@/screens/auth/use-create-account-transition";
import { mark, startFrameProbe } from "@/lib/frame-probe"; // TEMP profiling

const DESIGN_WIDTH = 416;
const DESIGN_HEIGHT = 895;

const BACKGROUND = "#FBF3EA";
const INK = "#1C1A18";
const MUTED = "#8E887E";
const LIGHT_BUTTON = "#F5EDE4";
const WHITE = "#FFFFFF";

// The cream mascot sits in a dedicated state-machine file: `namaste` loops
// while `isNamaste === true`, and setting it false tweens to `hello`. The
// runtime owns the transition and looping — we only flip the boolean.
const CREAM_SOURCE = CREAM_MASCOT_STATES;

const HEADLINES = [
  { line1: "Prepare Better", line2: "Perform better." },
  { line1: "Your ideas", line2: "Your stage." },
  { line1: "Find your voice", line2: "Own the room." },
] as const;

const BASE_DESCRIPTION =
  "Create stunning presentations, craft compelling speeches, and practice with confidence all in one place.";

type BlobKey = Exclude<MascotKey, "cream">;

type Layout = {
  size: number;
  top: number;
  left?: number;
  right?: number;
  zIndex: number;
};

type Motion = {
  scale: number;
  dx: number;
  dy: number;
  range: [number, number];
};

const BLOB_LAYOUT: Record<BlobKey, Layout> = {
  green: { size: 330, top: -80, left: -90, zIndex: 2 },
  pink: { size: 340, top: 15, left: -140, zIndex: 3 },
  blue: { size: 350, top: 130, left: -130, zIndex: 6 },
  orange: { size: 300, top: -10, right: -110, zIndex: 2 },
  yellow: { size: 300, top: 80, right: -110, zIndex: 3 },
  purple: { size: 300, top: 160, right: -110, zIndex: 6 },
};

// Final create-account placement of every surrounding mascot, tuned
// individually against the target composition. `dx`/`dy` are the movement of
// the mascot's centre (design units); `range` staggers each one.
const MASCOT_MOTION: Record<BlobKey, Motion> = {
  green: { scale: 0.8, dx: -30, dy: -30, range: [0.05, 0.72] },
  pink: { scale: 0.8, dx: -10, dy: -50, range: [0.1, 0.78] },
  blue: { scale: 0.8, dx: -10, dy: -80, range: [0.0, 0.7] },
  orange: { scale: 0.9, dx: 10, dy: -80, range: [0.08, 0.75] },
  yellow: { scale: 1, dx: -10, dy: -88, range: [0.12, 0.8] },
  purple: { scale: 1, dx: 0, dy: -85, range: [0.02, 0.72] },
};

const CREAM_SIZE = 320;
// The cream mascot grows only relative to the surroundings; in absolute terms
// the target is a touch smaller than the base pose.
const CREAM_MOTION = { scale: 1.16, dx: -10, dy: -110 };
const CREAM_RANGE: [number, number] = [0, 0.7];

const GROUND = {
  left: -80,
  top: 320,
  width: DESIGN_WIDTH + 160,
  curveDepth: 230,
  targetCurveDepth: 180,
  height: 380,
  lift: 100,
  curveOffset: 0,
} as const;

const CLUSTER_TOP = 354;
const CLUSTER_HEIGHT = 460;
const NOTE_WIDTH = 96;

// How far the create-account headline + subtext group settles below its
// onboarding position, to use the empty space under the status bar. Tune this.
const CA_TEXT_DROP = 20;

// Curved doodle arrows: `from` is the onboarding position, `to` is where the
// arrow settles in the create-account state. All values are design units, so
// edit either end freely.
const ARROW_TOP = {
  from: { left: 112, top: 85 },
  to: { left: 110, top: 116 },
  baseRotation: 0,
  targetRotation: 8,
} as const;

const ARROW_RIGHT = {
  from: { left: 256, top: 363 },
  to: { left: 320, top: 220 },
  baseRotation: 0,
  targetRotation: 180,
} as const;

const TwoSideCurvedArrow = memo(function TwoSideCurvedArrow({
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
        { position: "absolute", width: 40, height: 80 },
        style,
        flip && { transform: [...(style?.transform ?? []), { scaleX: -1 }] },
      ]}
    >
      <Svg width={40} height={80} viewBox="0 0 120 400" fill="none">
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
});

const YellowSquiggle = memo(function YellowSquiggle({
  style,
}: {
  style?: any;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute" }, style]}
    >
      <Svg width={80} height={90} viewBox="0 0 80 90" fill="none">
        <Path
          d="M 70 8 C 58 8, 42 12, 38 28 C 34 44, 50 54, 58 46 C 66 38, 60 26, 50 24 C 38 22, 22 32, 18 48"
          stroke="#F4CF66"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
});

/**
 * The mascots + ground, split into independent animated pieces that all read
 * the same transition `progress`.
 */
const MascotWorld = memo(function MascotWorld({
  scale,
  progress,
  isNamaste,
  focused,
}: {
  scale: number;
  progress: SharedValue<number>;
  isNamaste: boolean;
  focused: boolean;
}) {
  // Absolute layout is recomputed only when the screen scale changes, so the
  // memoized `AnimatedMascot`s below keep stable `position` prop identities.
  const blobPositions = useMemo(() => {
    return (Object.keys(BLOB_LAYOUT) as BlobKey[]).map((key) => {
      const layout = BLOB_LAYOUT[key];
      const size = layout.size * scale;
      return {
        key,
        source: MASCOTS[key],
        size,
        zIndex: layout.zIndex,
        targetScale: MASCOT_MOTION[key].scale,
        targetDx: MASCOT_MOTION[key].dx * scale,
        targetDy: MASCOT_MOTION[key].dy * scale,
        inputRange: MASCOT_MOTION[key].range,
        position: {
          width: size,
          height: size,
          top: layout.top * scale,
          ...(layout.left !== undefined
            ? { left: layout.left * scale }
            : { right: layout.right! * scale }),
        },
      };
    });
  }, [scale]);

  const creamPosition = useMemo(
    () => ({
      width: CREAM_SIZE * scale,
      height: CREAM_SIZE * scale,
      left: ((DESIGN_WIDTH - CREAM_SIZE + 30) / 2) * scale,
      top: 100 * scale,
    }),
    [scale],
  );

  return (
    <View
      pointerEvents="none"
      style={[
        styles.mascotCluster,
        { width: DESIGN_WIDTH * scale, height: CLUSTER_HEIGHT * scale },
      ]}
    >
      {blobPositions.map((blob) => (
        <AnimatedMascot
          key={blob.key}
          source={blob.source}
          size={blob.size}
          zIndex={blob.zIndex}
          progress={progress}
          targetScale={blob.targetScale}
          targetDx={blob.targetDx}
          targetDy={blob.targetDy}
          inputRange={blob.inputRange}
          position={blob.position}
          paused={!focused}
        />
      ))}

      <AnimatedOrganicGround
        key={`ground-${scale}`}
        width={GROUND.width * scale}
        height={(GROUND.height + GROUND.lift) * scale}
        x={GROUND.left * scale}
        y={(GROUND.top - GROUND.lift) * scale}
        progress={progress}
        crestFrom={GROUND.lift * scale}
        crestTo={10}
        depthFrom={GROUND.curveDepth * scale}
        depthTo={GROUND.targetCurveDepth * scale}
        curveOffset={GROUND.curveOffset}
        fill={WHITE}
        zIndex={8}
      />

      <AnimatedMascot
        source={CREAM_SOURCE}
        size={CREAM_SIZE * scale}
        zIndex={10}
        progress={progress}
        targetScale={CREAM_MOTION.scale}
        targetDx={CREAM_MOTION.dx * scale}
        targetDy={CREAM_MOTION.dy * scale}
        inputRange={CREAM_RANGE}
        position={creamPosition}
        stateMachineId="mascot"
        stateMachineInput="isNamaste"
        stateMachineValue={isNamaste}
        paused={!focused}
      />
    </View>
  );
});

const BLOBS = [
  {
    seed: "onboarding-mint",
    x: 40,
    y: -70,
    size: 260,
    color: "#D3EBDD",
    opacity: 0.55,
    rotation: 10,
  },
  {
    seed: "onboarding-cream",
    x: 250,
    y: 20,
    size: 240,
    color: "#F6E7D2",
    opacity: 0.6,
    rotation: -8,
  },
  {
    seed: "onboarding-pink",
    x: -120,
    y: 200,
    size: 400,
    color: "#f6d3e09b",
    opacity: 0.8,
    rotation: 90,
  },
  {
    seed: "onboarding-yellow",
    x: 290,
    y: 240,
    size: 320,
    color: "#F7E7A6",
    opacity: 0.8,
    rotation: 6,
  },
] as const;

/** Procedural ShapeSoup blobs that fade in with the screen transition. */
const BlobLayer = memo(function BlobLayer({
  scale,
  progress,
}: {
  scale: number;
  progress: SharedValue<number>;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BLOBS.map((blob) => (
        <OrganicBlob
          key={blob.seed}
          seed={blob.seed}
          width={blob.size * scale}
          height={blob.size * scale}
          color={blob.color}
          x={blob.x * scale}
          y={blob.y * scale}
          opacity={blob.opacity}
          initialRotation={blob.rotation}
          revealProgress={progress}
        />
      ))}
    </View>
  );
});

const CTAButton = memo(function CTAButton({
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
      onPress={() => {
        weight.press();
        onPress();
      }}
      style={({ pressed }) => [
        styles.cta,
        primary ? styles.primaryCta : styles.secondaryCta,
        pressed && styles.ctaPressed,
      ]}
    >
      <Text style={[styles.ctaLabel, { color: primary ? WHITE : INK }]}>
        {label}
      </Text>
      {primary && <Text style={styles.ctaArrow}>→</Text>}
    </Pressable>
  );
});

/**
 * Owns the rotating onboarding headline state so its 4.2s `setInterval` only
 * re-renders this block — never the mascots, ground or blobs.
 */
const RotatingHeadline = memo(function RotatingHeadline({
  progress,
  createOffsetY,
  style,
}: {
  progress: SharedValue<number>;
  createOffsetY: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    let swap: ReturnType<typeof setTimeout>;

    const interval = setInterval(() => {
      opacity.value = withTiming(0, { duration: 140 });
      swap = setTimeout(() => {
        setIndex((previous) => (previous + 1) % HEADLINES.length);
        opacity.value = withTiming(1, { duration: 220 });
      }, 150);
    }, 4200);

    return () => {
      clearInterval(interval);
      clearTimeout(swap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = HEADLINES[index];

  return (
    <MorphHeadline
      progress={progress}
      baseLine1={current.line1}
      baseLine2={current.line2}
      rotationOpacity={opacity}
      createOffsetY={createOffsetY}
      style={style}
    />
  );
});

export default function Base() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{
    createAccount?: string;
    from?: string;
  }>();
  // Set when the login screen sent us here via its "Sign up" link. The back
  // button then pops to login instead of reversing the morph.
  const cameFromLogin = params.from === "login";

  const { screenMode, settled, progress, startTransition, goBack } =
    useCreateAccountTransition();

  // Entering from login lands on this screen already morphed into the
  // create-account state; run the forward transition once on mount.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (params.createAccount !== "1") return;
    autoStartedRef.current = true;
    startTransition();
  }, [params.createAccount, startTransition]);

  const handleBack = useCallback(() => {
    if (cameFromLogin) {
      router.back();
      return;
    }
    goBack();
  }, [cameFromLogin, goBack, router]);

  const scale = useMemo(
    () => Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT),
    [width, height],
  );

  const canvasWidth = DESIGN_WIDTH * scale;
  const canvasHeight = DESIGN_HEIGHT * scale;
  const horizontalOffset = Math.max((width - canvasWidth) / 2, 0);
  const safeTop = Math.max(insets.top, 0);
  const topLift = Math.min(safeTop, 32);
  const isBase = screenMode === "base";

  // Android hardware back reverses the morph instead of leaving the route.
  useEffect(() => {
    if (screenMode !== "create-account") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [screenMode, handleBack]);

  const baseButtonsStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      [0, 0.32],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: 1 - p,
      transform: [
        { translateY: interpolate(p, [0, 1], [0, 50]) },
        { scale: interpolate(p, [0, 1], [1, 0.96]) },
      ],
    };
  });

  const createPanelStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      [0.55, 0.95],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: p,
      transform: [{ translateY: interpolate(p, [0, 1], [44, 0]) }],
    };
  });

  const footerStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      [0, 0.3],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: 1 - p,
      transform: [
        { translateY: interpolate(p, [0, 1], [0, 36]) },
        { scale: interpolate(p, [0, 1], [1, 0.94]) },
      ],
    };
  });

  const squiggleStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      [0.45, 0.9],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: p,
      transform: [
        { translateY: interpolate(p, [0, 1], [-16, 0]) },
        { rotate: `${interpolate(p, [0, 1], [-18, 0])}deg` },
        { scale: interpolate(p, [0, 1], [0.6, 1]) },
      ],
    };
  });

  const handleLogin = useCallback(() => {
    startFrameProbe("base->login"); // TEMP profiling
    mark("router.push");
    router.push("/(unauthenticated)/login");
  }, [router]);

  // Layout objects are derived from `scale` only; memoizing them keeps the
  // memoized morph/mascot children from re-rendering on unrelated updates.
  const noteLeft = useMemo(
    () => ({
      from: { left: 25, top: 85 },
      to: { left: 300 * scale, top: 118 * scale },
    }),
    [scale],
  );
  const noteRight = useMemo(
    () => ({
      from: { left: DESIGN_WIDTH * scale - NOTE_WIDTH, top: 330 },
      to: { left: 28, top: 130 },
    }),
    [scale],
  );
  const arrowTop = useMemo(
    () => ({
      from: {
        left: ARROW_TOP.from.left * scale,
        top: ARROW_TOP.from.top * scale,
      },
      to: { left: ARROW_TOP.to.left * scale, top: ARROW_TOP.to.top * scale },
    }),
    [scale],
  );
  const arrowRight = useMemo(
    () => ({
      from: {
        left: ARROW_RIGHT.from.left * scale,
        top: ARROW_RIGHT.from.top * scale,
      },
      to: {
        left: ARROW_RIGHT.to.left * scale,
        top: ARROW_RIGHT.to.top * scale,
      },
    }),
    [scale],
  );
  const squigglePlacement = useMemo(
    () => ({
      left: 255 * scale - 60,
      top: 100 * scale + 120,
      zIndex: 1,
    }),
    [scale],
  );
  const squiggleStyleArray = useMemo(
    () => [styles.squiggle, squigglePlacement, squiggleStyle],
    [squigglePlacement, squiggleStyle],
  );
  const footerArrowStyle = useMemo(
    () => ({
      right: -5,
      bottom: -10,
      left: undefined,
      top: undefined,
      transform: [{ rotate: "-180deg" }],
    }),
    [],
  );
  const createPanelPlacement = useMemo(
    () => ({ bottom: Math.max(insets.bottom, 16) - 30 }),
    [insets.bottom],
  );
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerTransparent: true, title: "" }} />

      {/* The same toolbar back button used across the auth screens. Mounted
          only once the forward morph has settled, so it appears after the
          animation; unmounting on the reverse morph hides it again. */}
      {settled && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="chevron.backward" onPress={handleBack} />
        </Stack.Toolbar>
      )}

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
        <BlobLayer scale={scale} progress={progress} />

        <MorphNote
          progress={progress}
          baseText={"Ideas today,\nbetter\ntomorrow."}
          targetText={"Ideas today,\nbetter\ntomorrow."}
          from={noteLeft.from}
          to={noteLeft.to}
          baseRotation={-8}
          targetRotation={7}
          width={NOTE_WIDTH}
        />
        <MorphNote
          progress={progress}
          baseText={"Same you,\nBrighter\nideas."}
          targetText={"Same you,\nbrighter\nideas."}
          from={noteRight.from}
          to={noteRight.to}
          baseRotation={7}
          targetRotation={-8}
          width={NOTE_WIDTH}
        />

        <MorphArrow
          progress={progress}
          from={arrowTop.from}
          to={arrowTop.to}
          baseRotation={ARROW_TOP.baseRotation}
          targetRotation={ARROW_TOP.targetRotation}
        />
        <MorphArrow
          progress={progress}
          from={arrowRight.from}
          to={arrowRight.to}
          baseRotation={ARROW_RIGHT.baseRotation}
          targetRotation={ARROW_RIGHT.targetRotation}
          flip
        />

        <RotatingHeadline
          progress={progress}
          createOffsetY={CA_TEXT_DROP * scale}
          style={styles.headlineBlock}
        />

        <MorphDescription
          progress={progress}
          baseText={BASE_DESCRIPTION}
          createOffsetY={CA_TEXT_DROP * scale}
          style={styles.descriptionBlock}
        />

        <YellowSquiggle style={squiggleStyleArray} />

        <MascotWorld
          scale={scale}
          progress={progress}
          isNamaste={isBase}
          focused={isFocused}
        />

        <Animated.View
          pointerEvents={isBase ? "auto" : "none"}
          style={[styles.buttonStack, baseButtonsStyle]}
        >
          <CTAButton
            label="Create an account"
            variant="primary"
            onPress={startTransition}
          />
          <CTAButton label="Log in" variant="secondary" onPress={handleLogin} />
        </Animated.View>

        <Animated.View
          pointerEvents={isBase ? "none" : "auto"}
          style={[
            styles.createPanelWrap,
            createPanelPlacement,
            createPanelStyle,
          ]}
        >
          <CreateAccountPanel />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.footerRow, footerStyle]}
        >
          <Text style={styles.bottomRightNote}>
            {"Small steps\nbig progress."}
          </Text>
          <TwoSideCurvedArrow flip style={footerArrowStyle} />
        </Animated.View>
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
  headlineBlock: {
    position: "absolute",
    top: 180,
    left: 20,
    right: 20,
    zIndex: 5,
  },
  descriptionBlock: {
    position: "absolute",
    top: 268,
    left: 56,
    right: 56,
  },
  squiggle: {
    zIndex: 3,
  },
  mascotCluster: {
    position: "absolute",
    left: 0,
    top: CLUSTER_TOP,
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
  createPanelWrap: {
    position: "absolute",
    left: 28,
    right: 28,
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
  bottomRightNote: {
    position: "absolute",
    right: 25,
    bottom: 16,
    width: 94,
    transform: [{ rotate: "-5deg" }],
    textAlign: "left",
    color: MUTED,
    fontFamily: fonts.kalam.regular,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
});
