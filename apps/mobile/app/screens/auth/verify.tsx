// TODO: mascot scene, floating text, background blobs, bottom shapes, morphing arrows needs refining and cleanup.
import { isClerkAPIResponseError, useSignIn, useSignUp } from "@clerk/expo";
import {
  Stack,
  useIsFocused,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import AnimatedMascot from "@/components/ui/animated-mascot";
import OrganicBlob from "@/components/ui/organic-blob";
import { fonts } from "@/constants/fonts";
import { BLOB_CREAM_MASCOT, MASCOTS } from "@/constants/mascots";
import { MorphArrow } from "@/screens/auth/components/morph-arrow";
import { useTransitionSettled } from "@/screens/auth/use-transition-settled";

const BACKGROUND = "#FBF3EA";
const INK = "#1C1A18";
const MUTED = "#8E887E";
const BORDER = "#E7DFD3";
const FIELD_BG = "#FFFDF9";
const WHITE = "#FFFFFF";
const DANGER = "#C0392B";
const GROUND = "#FFFCF5";

// The illustration is authored against a fixed design width and scaled to the
// device, so tuning stays in one coordinate space.
const DESIGN_WIDTH = 416;
const HERO_HEIGHT = 280;
const GUTTER = 24;

// Every mascot Lottie draws its character at ~45% of its 720x720 canvas, so a
// square sized for a target character is `characterSize / CHARACTER_RATIO`.
const CHARACTER_RATIO = 0.45;

export const OTP_LENGTH = 6;
export const RESEND_SECONDS = 30;

type MascotPlacement = {
  character: number;
  cx: number;
  cy: number;
  zIndex: number;
};

const CREAM_PLACEMENT: MascotPlacement = {
  character: 158,
  cx: 208,
  cy: 118,
  zIndex: 15,
};

// The colourful blobs tuck behind the cloud so only their tops peek out, just
// like the reference. The cream hero sits in front of the cloud.
const SURROUNDING_MASCOTS = [
  { key: "pink", character: 118, cx: 40, cy: 198, zIndex: 5 },
  // { key: "blue", character: 108, cx: 380, cy: 214, zIndex: 4 },
  // { key: "yellow", character: 98, cx: 376, cy: 96, zIndex: 3 },
] as const;

/** Resolves a design-unit placement to the square Lottie layout in points. */
function mascotLayout(placement: MascotPlacement, scale: number) {
  const size = (placement.character / CHARACTER_RATIO) * scale;
  return {
    size,
    position: {
      width: size,
      height: size,
      left: placement.cx * scale - size / 2,
      top: placement.cy * scale - size / 2,
    },
  };
}

const GROUND_SHAPE = {
  width: 480,
  height: 1400,
  left: -32,
  top: 150,
} as const;

const CLOUD_PATH = [
  "M -24 130",
  "A 40 40 0 0 1 56 130",
  "A 30 30 0 0 1 116 130",
  "A 50 50 0 0 1 216 130",
  "A 35 35 0 0 1 286 130",
  "A 45 45 0 0 1 376 130",
  "A 33 33 0 0 1 442 130",
  "A 31 31 0 0 1 504 130",
  "A 264 620 0 0 1 -24 130",
  "Z",
].join(" ");

export function friendlyVerifyError(error: unknown): string {
  const code = isClerkAPIResponseError(error)
    ? error.errors?.[0]?.code
    : (error as { code?: string } | null | undefined)?.code;

  switch (code) {
    case "form_code_incorrect":
      return "That code doesn't look right. Check your email and try again.";
    case "verification_expired":
      return "That code has expired. Request a new one.";
    case "too_many_requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Oops! That's incorrect.";
  }
}

/**
 * One OTP cell. The border colour and a small lift are driven by Reanimated so
 * the active cell reads clearly without re-rendering the whole row.
 */
const OtpCell = memo(function OtpCell({
  value,
  active,
}: {
  value: string;
  active: boolean;
}) {
  const focus = useSharedValue(0);

  useEffect(() => {
    focus.value = withTiming(active ? 1 : 0, { duration: 160 });
  }, [active, focus]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [BORDER, INK]),
    transform: [{ scale: 1 + focus.value * 0.05 }],
  }));

  return (
    <Animated.View accessible={false} style={[styles.otpCell, animatedStyle]}>
      {value ? <Text style={styles.otpDigit}>{value}</Text> : null}
    </Animated.View>
  );
});

/**
 * Six cells driven by a single hidden TextInput, so native keyboard, backspace
 * and full-code paste/auto-fill all keep working while the presentation stays
 * custom. The input overlays the row invisibly and owns focus.
 */
export const OtpInput = memo(function OtpInput({
  code,
  onChangeText,
  editable,
  autoFocus,
}: {
  code: string;
  onChangeText: (text: string) => void;
  editable: boolean;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(code.length, OTP_LENGTH - 1);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={styles.otpRow}
      accessibilityRole="none"
    >
      {Array.from({ length: OTP_LENGTH }).map((_, index) => (
        <OtpCell
          key={index}
          value={code[index] ?? ""}
          active={focused && index === activeIndex}
        />
      ))}

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        editable={editable}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.otpHiddenInput}
        accessibilityLabel="Verification code"
        accessibilityHint="Enter the six digit code sent to your email"
      />
    </Pressable>
  );
});

/**
 * The cream cloud the form sits on. Purely decorative code-drawn geometry (not
 * a mascot), memoized so the SVG path string is built once.
 */
const CloudGround = memo(function CloudGround({ scale }: { scale: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.cloudGround,
        {
          left: GROUND_SHAPE.left * scale,
          top: GROUND_SHAPE.top * scale,
          width: GROUND_SHAPE.width * scale,
          height: GROUND_SHAPE.height * scale,
          zIndex: 7,
        },
      ]}
    >
      <Svg
        width={GROUND_SHAPE.width * scale}
        height={GROUND_SHAPE.height * scale}
        viewBox={`0 0 ${GROUND_SHAPE.width} ${GROUND_SHAPE.height}`}
      >
        <Path d={CLOUD_PATH} fill={GROUND} />
      </Svg>
    </View>
  );
});

/**
 * The hero mascot, the supporting blobs and the organic ground. Memoized and
 * driven by a device-width scale so typing the code never re-renders or
 * restarts the Lottie animations.
 */
const MascotScene = memo(function MascotScene({
  scale,
  focused,
}: {
  scale: number;
  focused: boolean;
}) {
  // A fixed shared value: nothing morphs here, but AnimatedMascot and
  // MorphArrow both read a `progress` value, so one static driver is shared.
  const still = useSharedValue(0);

  const blobs = useMemo(
    () =>
      SURROUNDING_MASCOTS.map((blob) => {
        const { size, position } = mascotLayout({ ...blob }, scale);
        return {
          key: blob.key,
          source: MASCOTS[blob.key],
          size,
          zIndex: blob.zIndex,
          position,
        };
      }),
    [scale],
  );

  const cream = useMemo(() => mascotLayout(CREAM_PLACEMENT, scale), [scale]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.mascotScene,
        { width: DESIGN_WIDTH * scale, height: HERO_HEIGHT * scale },
      ]}
    >
      {blobs.map((blob) => (
        <AnimatedMascot
          key={blob.key}
          source={blob.source}
          size={blob.size}
          zIndex={blob.zIndex}
          progress={still}
          position={blob.position}
          paused={!focused}
        />
      ))}

      <CloudGround scale={scale} />

      <AnimatedMascot
        source={BLOB_CREAM_MASCOT}
        size={cream.size}
        zIndex={CREAM_PLACEMENT.zIndex}
        progress={still}
        position={cream.position}
        stateMachineId="mascot"
        stateMachineInput="isNamaste"
        stateMachineValue
        paused={!focused}
      />
    </View>
  );
});

/** Handwritten-style doodle note surrounding the mascot. */
const DoodleNote = memo(function DoodleNote({
  text,
  style,
}: {
  text: string;
  style: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.doodleNote, style]}>{text}</Text>;
});

/**
 * Procedural ShapeSoup blobs that frame the screen. Geometry is generated once
 * per seed inside OrganicBlob; here we only fade the layer in on mount.
 */
const BackgroundBlobs = memo(function BackgroundBlobs({
  width,
  height,
  reveal,
}: {
  width: number;
  height: number;
  reveal: SharedValue<number>;
}) {
  const blobs = useMemo(
    () => [
      {
        seed: "verify-peach",
        x: width - 150,
        y: -130,
        size: 300,
        color: "#F6E7D2",
        opacity: 0.6,
        rotation: -12,
      },
      {
        seed: "verify-mint",
        x: -140,
        y: -110,
        size: 240,
        color: "#D3EBDD",
        opacity: 0.45,
        rotation: 20,
      },
      {
        seed: "verify-rose",
        x: width - 120,
        y: height * 0.3,
        size: 220,
        color: "#F7D3DE",
        opacity: 0.35,
        rotation: 70,
      },
    ],
    [width, height],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {blobs.map((blob) => (
        <OrganicBlob
          key={blob.seed}
          seed={blob.seed}
          width={blob.size}
          height={blob.size}
          color={blob.color}
          x={blob.x}
          y={blob.y}
          opacity={blob.opacity}
          initialRotation={blob.rotation}
          revealProgress={reveal}
        />
      ))}
    </View>
  );
});

/**
 * Large pastel organic shapes entering from the bottom corners. Positioned from
 * the screen bottom and z-indexed so they sit on the cream ground, behind the
 * form.
 */
const BottomShapes = memo(function BottomShapes({
  width,
  bottom,
  reveal,
}: {
  width: number;
  /** Distance in points from the top of the hero to the screen bottom. */
  bottom: number;
  reveal: SharedValue<number>;
}) {
  const blobs = useMemo(
    () => [
      {
        seed: "verify-bottom-yellow",
        x: -95,
        y: bottom - 150,
        size: 285,
        color: "#F8E3A8",
        opacity: 0.95,
        rotation: -8,
      },
      {
        seed: "verify-bottom-blue",
        x: width - 165,
        y: bottom - 145,
        size: 330,
        color: "#CFE0F7",
        opacity: 0.95,
        rotation: 12,
      },
    ],
    [width, bottom],
  );

  return (
    <>
      {blobs.map((blob) => (
        <OrganicBlob
          key={blob.seed}
          seed={blob.seed}
          width={blob.size}
          height={blob.size}
          color={blob.color}
          x={blob.x}
          y={blob.y}
          zIndex={2}
          opacity={blob.opacity}
          initialRotation={blob.rotation}
          revealProgress={reveal}
        />
      ))}
    </>
  );
});

// This screen is shared by two different Clerk flows:
//  - Sign-in second factor (email code) -> useSignIn / signIn.mfa.*
//  - Sign-up email verification          -> useSignUp / signUp.verifications.*
// It figures out which one is actually in progress and branches accordingly,
// so both login.tsx and signup.tsx can push the same "/verify" route.
export default function Verify() {
  const {
    signIn,
    errors: signInErrors,
    fetchStatus: signInFetchStatus,
  } = useSignIn();
  const {
    signUp,
    errors: signUpErrors,
    fetchStatus: signUpFetchStatus,
  } = useSignUp();
  const router = useRouter();
  const isFocused = useIsFocused();
  const settled = useTransitionSettled();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const { flow } = useLocalSearchParams<{ flow: "signIn" | "signUp" }>();
  const mode = flow === "signIn" || flow === "signUp" ? flow : null;

  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const fetchStatus = mode === "signIn" ? signInFetchStatus : signUpFetchStatus;
  const isSubmitting = fetchStatus === "fetching";

  const clerkCodeError =
    mode === "signIn" ? signInErrors.fields.code : signUpErrors.fields.code;
  const errorMessage =
    localError ?? (clerkCodeError ? friendlyVerifyError(clerkCodeError) : null);

  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withTiming(1, { duration: 700 });
  }, [reveal]);

  // Countdown to the next allowed resend. One timeout per tick, cleared on
  // unmount and whenever the screen loses the code.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timeout = setTimeout(
      () => setSecondsLeft((previous) => previous - 1),
      1000,
    );
    return () => clearTimeout(timeout);
  }, [secondsLeft]);

  // Shrink on short iPhones instead of pushing the form off-screen; the clamp
  // keeps tablets/landscape from blowing the illustration up.
  const scale = useMemo(
    () => Math.min(width / DESIGN_WIDTH, height / 900, 1.15),
    [width, height],
  );

  // The hero sits below the top inset and the 44pt back button, so distance to
  // the screen bottom anchors the pastel shapes correctly on every device.
  const heroTop = insets.top + 6 + 44;
  const bottomFromHero = height - heroTop;

  // One static arrow driver: `from` and `to` are identical, so MorphArrow is
  // reused without any morph animation.
  const arrowProgress = useSharedValue(0);
  const arrowLeft = useMemo(
    () => ({ left: 92 * scale, top: 168 * scale }),
    [scale],
  );
  const arrowRight = useMemo(
    () => ({ left: 300 * scale, top: 46 * scale }),
    [scale],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(unauthenticated)/login");
  }, [router]);

  const navigateHome = (
    session: { currentTask?: unknown } | null,
    decorateUrl: (path: string) => string,
  ) => {
    if (session?.currentTask) {
      console.log(session.currentTask);
      return;
    }
    const url = decorateUrl("/");
    if (url.startsWith("http")) {
      window.location.href = url;
    }
  };

  const handleChangeCode = useCallback((text: string) => {
    setCode(text.replace(/\D/g, "").slice(0, OTP_LENGTH));
    setLocalError(null);
  }, []);

  const handleVerify = async () => {
    if (!mode || isSubmitting) return;

    setLocalError(null);
    const trimmed = code.trim();

    if (trimmed.length < OTP_LENGTH) {
      setLocalError("Enter the 6-digit code we sent you.");
      return;
    }

    try {
      const { error } =
        mode === "signIn"
          ? await signIn.mfa.verifyEmailCode({ code: trimmed })
          : await signUp.verifications.verifyEmailCode({ code: trimmed });

      if (error) {
        setLocalError(friendlyVerifyError(error));
        return;
      }

      if (mode === "signIn") {
        if (signIn.status === "complete") {
          await signIn.finalize({
            navigate: ({ session, decorateUrl }) =>
              navigateHome(session, decorateUrl),
          });
        } else {
          console.error("Sign-in attempt not complete:", signIn);
        }
      } else {
        if (signUp.status === "complete") {
          await signUp.finalize({
            navigate: ({ session, decorateUrl }) =>
              navigateHome(session, decorateUrl),
          });
        } else {
          console.error("Sign-up attempt not complete:", signUp);
        }
      }
    } catch (err) {
      console.error("Verification error:", JSON.stringify(err, null, 2));
      setLocalError("Something went wrong. Please try again.");
    }
  };

  const handleResend = async () => {
    if (!mode || isSubmitting || secondsLeft > 0) return;

    setLocalError(null);
    try {
      if (mode === "signIn") {
        await signIn.mfa.sendEmailCode();
      } else {
        await signUp.verifications.sendEmailCode();
      }
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      console.error("Resend error:", JSON.stringify(err, null, 2));
      setLocalError("We couldn't resend the code. Please try again.");
    }
  };

  if (!mode) {
    router.replace("/(unauthenticated)/login");
    return null;
  }

  const canSubmit = code.length === OTP_LENGTH && !isSubmitting;
  const resendLabel =
    secondsLeft > 0
      ? `Resend Code (00:${String(secondsLeft).padStart(2, "0")})`
      : "Resend Code";

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <Stack.Screen options={{ headerTransparent: true, title: "" }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="chevron.backward" onPress={goBack} />
      </Stack.Toolbar>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <BackgroundBlobs width={width} height={height} reveal={reveal} />
      </View>

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: heroTop,
            paddingBottom: Math.max(insets.bottom, 14) + 6,
          },
        ]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <View
          pointerEvents="none"
          style={[styles.hero, { height: HERO_HEIGHT * scale }]}
        >
          {settled && <MascotScene scale={scale} focused={isFocused} />}

          {/* <DoodleNote
            text={"Almost\nthere!"}
            style={[styles.noteRight, { right: 16 * scale, top: 4 * scale }]}
          />
          <DoodleNote
            text={"Just a\nmoment."}
            style={[styles.noteLeft, { left: 12 * scale, top: 120 * scale }]}
          /> */}

          {/* <MorphArrow
            progress={arrowProgress}
            from={arrowLeft}
            to={arrowLeft}
            baseRotation={30}
          />
          <MorphArrow
            progress={arrowProgress}
            from={arrowRight}
            to={arrowRight}
            baseRotation={-6}
            flip
          /> */}

          <BottomShapes width={width} bottom={bottomFromHero} reveal={reveal} />
        </View>

        <View style={styles.form}>
          <Text style={styles.heading}>Verify your account</Text>
          <Text style={styles.subtitle}>
            Enter the verification code we sent to your provided email.
          </Text>

          <OtpInput
            code={code}
            onChangeText={handleChangeCode}
            editable={!isSubmitting}
          />

          {errorMessage ? (
            <Text style={styles.error}>{errorMessage}</Text>
          ) : null}

          <View style={styles.resend}>
            <Text style={styles.resendPrompt}>
              Didn&apos;t receive a code?
            </Text>
            <Pressable
              onPress={handleResend}
              disabled={secondsLeft > 0 || isSubmitting}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{
                disabled: secondsLeft > 0 || isSubmitting,
              }}
              accessibilityLabel={resendLabel}
            >
              <Text
                style={[
                  styles.resendLink,
                  (secondsLeft > 0 || isSubmitting) &&
                    styles.resendLinkDisabled,
                ]}
              >
                {resendLabel}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleVerify}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            style={({ pressed }) => [
              styles.submit,
              !canSubmit && styles.submitDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.submitLabel}>
              {isSubmitting ? "Verifying…" : "Verify"}
            </Text>
            {isSubmitting ? (
              <ActivityIndicator color={WHITE} style={styles.submitSpinner} />
            ) : (
              <Text style={styles.submitArrow}>→</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  hero: {
    width: "100%",
    overflow: "visible",
  },
  mascotScene: {
    alignSelf: "center",
    overflow: "visible",
  },
  cloudGround: {
    position: "absolute",
  },
  doodleNote: {
    position: "absolute",
    fontFamily: fonts.kalam.regular,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: 0.2,
    color: MUTED,
  },
  noteRight: {
    width: 96,
    transform: [{ rotate: "6deg" }],
  },
  noteLeft: {
    width: 88,
    transform: [{ rotate: "-8deg" }],
  },
  form: {
    paddingHorizontal: GUTTER,
    marginVertical: 40,
  },
  heading: {
    fontFamily: fonts.alanSans.black,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
    color: INK,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.alanSans.regular,
    fontSize: 15,
    lineHeight: 21,
    color: MUTED,
    textAlign: "center",
    alignSelf: "center",
    maxWidth: 320,
    marginTop: 10,
  },
  otpRow: {
    position: "relative",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
  },
  otpCell: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.82,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: FIELD_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: {
    fontFamily: fonts.alanSans.bold,
    fontSize: 22,
    color: INK,
  },
  otpHiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  error: {
    fontFamily: fonts.alanSans.medium,
    fontSize: 13,
    lineHeight: 18,
    color: DANGER,
    marginTop: 12,
  },
  resend: {
    alignItems: "center",
    gap: 4,
    marginTop: 26,
  },
  resendPrompt: {
    fontFamily: fonts.alanSans.regular,
    fontSize: 14,
    color: MUTED,
  },
  resendLink: {
    fontFamily: fonts.alanSans.bold,
    fontSize: 14,
    color: INK,
  },
  resendLinkDisabled: {
    color: MUTED,
  },
  submit: {
    height: 48,
    borderRadius: 24,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitLabel: {
    fontFamily: fonts.alanSans.bold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: WHITE,
  },
  submitArrow: {
    position: "absolute",
    right: 22,
    fontFamily: fonts.alanSans.bold,
    fontSize: 20,
    lineHeight: 22,
    color: WHITE,
  },
  submitSpinner: {
    position: "absolute",
    right: 22,
  },
});
