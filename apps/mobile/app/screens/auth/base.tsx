import {
  Stack,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { ONBOARDING_MASCOTS } from "@/constants/mascots";
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
import { useOnboardingPendingStore } from "@/store/onboarding-pending.store";
import { mark, startFrameProbe } from "@/lib/frame-probe"; // TEMP profiling

const DESIGN_WIDTH = 416;
const DESIGN_HEIGHT = 895;

const BACKGROUND = "#FBF3EA";
const INK = "#1C1A18";
const MUTED = "#8E887E";
const LIGHT_BUTTON = "#F5EDE4";
const WHITE = "#FFFFFF";

const HEADLINES = [
  { line1: "Prepare Better", line2: "Perform better." },
  { line1: "Your ideas", line2: "Your stage." },
  { line1: "Find your voice", line2: "Own the room." },
] as const;

const BASE_DESCRIPTION =
  "Create stunning presentations, craft compelling speeches, and practice with confidence all in one place.";

// The whole cast is one state-machine file (1080x1299): `sayHi` false plays
// the default pose, true the wave. Laid out full-width, its edge mascots are
// cropped by the canvas the way the screen edge crops them. `top` puts the
// centre mascot's stand (canvas y≈976) on the ground's crest (y=320).
const SCENE = {
  top: -50,
  // Rides up with the ground (its crest rises ~90) into the create-account pose.
  motion: { scale: 1, dx: 0, dy: -90 },
  range: [0, 0.72] as [number, number],
};

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

// "Create an / Account" is two full-size lines where the base headline is one
// big line over a small one, so it runs about this much taller. The subtext
// drops by the difference, or its first line sits on "Account".
const CA_SUBTEXT_GAP = 38;

// Curved doodle arrows: `from` is the onboarding position, `to` is where the
// arrow settles in the create-account state. All values are design units, so
// edit either end freely.
const ARROW_TOP = {
  from: { left: 112, top: 85 },
  // Lowered with its note, clear of Create Account's back button.
  to: { left: 110, top: 136 },
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
  sayHi,
  focused,
}: {
  scale: number;
  progress: SharedValue<number>;
  sayHi: boolean;
  focused: boolean;
}) {
  const width = DESIGN_WIDTH * scale;
  const height = width * ONBOARDING_MASCOTS.aspect;
  // Memoized so the memoized `AnimatedMascot` keeps a stable `position`.
  const scenePosition = useMemo(
    () => ({ width, height, left: 0, top: SCENE.top * scale }),
    [width, height, scale],
  );

  return (
    <View
      pointerEvents="none"
      style={[
        styles.mascotCluster,
        { width: DESIGN_WIDTH * scale, height: CLUSTER_HEIGHT * scale },
      ]}
    >
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
        source={ONBOARDING_MASCOTS.source}
        size={width}
        height={height}
        zIndex={10}
        progress={progress}
        targetScale={SCENE.motion.scale}
        targetDx={SCENE.motion.dx * scale}
        targetDy={SCENE.motion.dy * scale}
        inputRange={SCENE.range}
        position={scenePosition}
        stateMachineId={ONBOARDING_MASCOTS.machineId}
        stateMachineInput={ONBOARDING_MASCOTS.input}
        stateMachineValue={sayHi}
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

  const { screenMode, settled, progress, startTransition, goBack } =
    useCreateAccountTransition();

  // Entering from login lands on this screen already morphed into the
  // create-account state; run the forward transition once on mount. Onboarding
  // finishing sets the same request through the store, so the hand-off does not
  // depend on the route params surviving a pop.
  const createAccountRequested = useOnboardingPendingStore(
    (s) => s.createAccountRequested,
  );
  const consumeCreateAccountRequest = useOnboardingPendingStore(
    (s) => s.consumeCreateAccountRequest,
  );
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    // Only the focused instance morphs. Create Account is now pushed as a
    // second base instance on top of onboarding, and the transient store
    // request must not also flip the base screen sitting underneath it — that
    // left the front door stuck in its create-account state after backing out.
    if (!isFocused) return;
    if (params.createAccount !== "1" && !createAccountRequested) return;
    autoStartedRef.current = true;
    if (createAccountRequested) consumeCreateAccountRequest();
    startTransition();
  }, [
    isFocused,
    params.createAccount,
    createAccountRequested,
    consumeCreateAccountRequest,
    startTransition,
  ]);

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

  // Create Account is pushed on top of whatever led here — onboarding's last
  // step, or login — so back returns there. Reached with no history, it plays
  // the morph in reverse to the front door instead.
  const handleBack = useCallback(() => {
    weight.tap();
    if (router.canGoBack()) router.back();
    else goBack();
  }, [router, goBack]);

  // "Get started" always opens the onboarding flow. Create Account is only
  // reached by finishing the last onboarding step, so the two are never
  // collapsed into one another.
  const handleGetStarted = useCallback(() => {
    router.push("/(onboarding)");
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
      // Below the back button Create Account shows in the top-left corner.
      to: { left: 28, top: 152 },
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
      {/* The header only exists for Create Account's back button: shown once
          the morph has settled, so the button arrives with the new state
          rather than partway through it. Transparent, so nothing moves. */}
      <Stack.Screen
        options={{
          headerShown: settled,
          headerTransparent: true,
          headerTitle: "",
          headerShadowVisible: false,
          headerBackVisible: false,
        }}
      />
      {settled ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="chevron.backward"
            tintColor={INK}
            onPress={handleBack}
          />
        </Stack.Toolbar>
      ) : null}

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
          createOffsetY={CA_TEXT_DROP * scale + CA_SUBTEXT_GAP}
          style={styles.descriptionBlock}
        />

        <YellowSquiggle style={squiggleStyleArray} />

        <MascotWorld
          scale={scale}
          progress={progress}
          sayHi={!isBase}
          focused={isFocused}
        />

        <Animated.View
          pointerEvents={isBase ? "auto" : "none"}
          style={[styles.buttonStack, baseButtonsStyle]}
        >
          <CTAButton
            label="Get started"
            variant="primary"
            onPress={handleGetStarted}
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
