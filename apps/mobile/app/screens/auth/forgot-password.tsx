// TODO: add more cloud puffs and surrounding mascots and floating words and arrows placement.
import { isClerkAPIResponseError, useSignIn } from "@clerk/expo";
import { Stack, useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
  type TextInputProps,
} from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import AnimatedMascot from "@/components/ui/animated-mascot";
import OrganicBlob from "@/components/ui/organic-blob";
import { fonts } from "@/constants/fonts";
import { FORGOT_PASSWORD_MASCOT, MASCOTS } from "@/constants/mascots";
import { EMAIL_REGEX, MIN_PASSWORD_LENGTH } from "@/screens/auth/validation";
import { MorphArrow } from "@/screens/auth/components/morph-arrow";
import { useTransitionSettled } from "@/screens/auth/use-transition-settled";

const BACKGROUND = "#FBF3EA";
const INK = "#1C1A18";
const MUTED = "#8E887E";
const BORDER = "#E7DFD3";
const FIELD_BG = "#FFFDF9";
const WHITE = "#FFFFFF";
const DANGER = "#C0392B";
const RUST = "#B75C5C";
const GROUND = "#FFFCF5";
const ACCENT = "#F2B23E";

// The illustration is authored against a fixed design width and scaled to the
// device, so tuning stays in one coordinate space.
const DESIGN_WIDTH = 416;
const HERO_HEIGHT = 300;
const GUTTER = 24;

// Every mascot Lottie draws its character at ~45% of its 720x720 canvas, so a
// square sized for a target character is `characterSize / CHARACTER_RATIO`.
const CHARACTER_RATIO = 0.45;

type MascotPlacement = {
  character: number;
  cx: number;
  cy: number;
  zIndex: number;
};

type ResetStep = "email" | "code" | "password";

// `cy` is the canvas centre. This file draws its body high (canvas y≈0.39), so
// the centre sits ~38 below where the body should land (y≈120).
const CREAM_PLACEMENT: MascotPlacement = {
  character: 158,
  cx: 208,
  cy: 158,
  zIndex: 15,
};

// TODO: add after creation
const SURROUNDING_MASCOTS = [
  { key: "pink", character: 118, cx: 38, cy: 210, zIndex: 3 },
  // { key: "green", character: 128, cx: 386, cy: 92, zIndex: 3 },
  // { key: "yellow", character: 106, cx: 396, cy: 168, zIndex: 16 },
  // { key: "purple", character: 118, cx: 398, cy: 238, zIndex: 18 },
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
  top: 180,
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

function friendlyResetError(error: unknown): string {
  const code = isClerkAPIResponseError(error)
    ? error.errors?.[0]?.code
    : (error as { code?: string } | null | undefined)?.code;

  switch (code) {
    case "form_identifier_not_found":
    case "form_identifier_exists":
      return "We couldn't find an account with that email.";
    case "form_param_format_invalid":
      return "That email address doesn't look right.";
    case "form_code_incorrect":
      return "That code doesn't look right. Check your email and try again.";
    case "verification_expired":
      return "That code has expired. Request a new one.";
    case "form_password_length_too_short":
      return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    case "form_password_pwned":
      return "That password is too common. Try a stronger one.";
    case "too_many_requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

interface AuthFieldProps {
  icon: "envelope" | "lock" | "keyboard";
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  editable: boolean;
  secure?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  textContentType?: TextInputProps["textContentType"];
  autoComplete?: TextInputProps["autoComplete"];
  maxLength?: number;
  onSubmitEditing?: () => void;
}

const AuthField = memo(function AuthField({
  icon,
  value,
  onChangeText,
  placeholder,
  editable,
  secure = false,
  keyboardType = "default",
  textContentType,
  autoComplete,
  maxLength,
  onSubmitEditing,
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <FontAwesome6 name={icon} iconStyle="solid" size={18} color={MUTED} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        keyboardType={keyboardType}
        textContentType={textContentType}
        autoComplete={autoComplete}
        maxLength={maxLength}
        secureTextEntry={secure && hidden}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={onSubmitEditing}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.fieldInput}
      />
      {secure ? (
        <Pressable
          onPress={() => setHidden((previous) => !previous)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Show password" : "Hide password"}
        >
          <FontAwesome6
            name={hidden ? "eye" : "eye-slash"}
            iconStyle="solid"
            size={17}
            color={MUTED}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

/**
 * The cream cloud the heading sits on. Purely decorative code-drawn geometry
 * (not a mascot), memoized so the SVG path string is built once.
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
 * driven by a device-width scale so typing in the form never re-renders or
 * restarts the Lottie animations.
 */
const MascotScene = memo(function MascotScene({
  scale,
  focused,
  sent,
}: {
  scale: number;
  focused: boolean;
  /** Flips the mascot from idle to throwing the paper plane. */
  sent: boolean;
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
        source={FORGOT_PASSWORD_MASCOT.source}
        size={cream.size}
        zIndex={CREAM_PLACEMENT.zIndex}
        progress={still}
        position={cream.position}
        stateMachineId={FORGOT_PASSWORD_MASCOT.machineId}
        stateMachineInput={FORGOT_PASSWORD_MASCOT.input}
        stateMachineValue={sent}
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
        seed: "forgot-peach",
        x: width - 150,
        y: -130,
        size: 300,
        color: "#F6E7D2",
        opacity: 0.6,
        rotation: -12,
      },
      {
        seed: "forgot-mint",
        x: -140,
        y: -110,
        size: 240,
        color: "#D3EBDD",
        opacity: 0.45,
        rotation: 20,
      },
      {
        seed: "forgot-rose",
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
 * Large pastel organic shapes entering from the bottom corners. Procedural
 * (ShapeSoup via OrganicBlob), not rectangular blocks. Positioned from the
 * bottom of the screen and given a z-index above the cloud ground, so they sit
 * on top of the cream and behind the form.
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
        seed: "forgot-bottom-blue",
        x: -95,
        y: bottom - 150,
        size: 285,
        color: "#CFE0F7",
        opacity: 0.95,
        rotation: -8,
      },
      {
        seed: "forgot-bottom-cream",
        x: width - 165,
        y: bottom - 145,
        size: 330,
        color: "#F8E3A8",
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

export default function ForgotPasswordScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const isFocused = useIsFocused();
  const settled = useTransitionSettled();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = fetchStatus === "fetching";

  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withTiming(1, { duration: 700 });
  }, [reveal]);

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
    () => ({ left: 96 * scale, top: 176 * scale }),
    [scale],
  );
  const arrowRight = useMemo(
    () => ({ left: 302 * scale, top: 56 * scale }),
    [scale],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(unauthenticated)/login");
  }, [router]);

  const handleSendCode = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);
    const identifier = email.trim();

    if (!EMAIL_REGEX.test(identifier)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    try {
      const { error: createError } = await signIn.create({ identifier });
      if (createError) {
        setErrorMessage(
          errors.fields.identifier?.message ?? friendlyResetError(createError),
        );
        return;
      }

      const { error: sendError } =
        await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) {
        setErrorMessage(friendlyResetError(sendError));
        return;
      }

      setCode("");
      setStep("code");
    } catch (err) {
      console.error("Password reset error:", JSON.stringify(err, null, 2));
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  const handleResendCode = async () => {
    if (isSubmitting) return;
    setErrorMessage(null);

    try {
      const { error } = await signIn.resetPasswordEmailCode.sendCode();
      if (error) {
        setErrorMessage(friendlyResetError(error));
      }
    } catch (err) {
      console.error("Password reset error:", JSON.stringify(err, null, 2));
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  const handleVerifyCode = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);
    const trimmed = code.trim();

    if (trimmed.length < 4) {
      setErrorMessage("Enter the code we emailed you.");
      return;
    }

    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({
        code: trimmed,
      });
      if (error) {
        setErrorMessage(
          errors.fields.code?.message ?? friendlyResetError(error),
        );
        return;
      }

      setPassword("");
      setStep("password");
    } catch (err) {
      console.error("Password reset error:", JSON.stringify(err, null, 2));
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  const handleResetPassword = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({
        password,
        signOutOfOtherSessions: true,
      });
      if (error) {
        setErrorMessage(
          errors.fields.password?.message ?? friendlyResetError(error),
        );
        return;
      }

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            const url = decorateUrl("/");
            if (url.startsWith("http")) {
              window.location.href = url;
            }
          },
        });
      } else if (signIn.status === "needs_second_factor") {
        const emailCodeFactor = signIn.supportedSecondFactors.find(
          (factor) => factor.strategy === "email_code",
        );
        if (emailCodeFactor) {
          await signIn.mfa.sendEmailCode();
        }
        router.push({
          pathname: "/(unauthenticated)/verify",
          params: { flow: "signIn" },
        });
      } else {
        setErrorMessage("We couldn't reset your password. Please try again.");
      }
    } catch (err) {
      console.error("Password reset error:", JSON.stringify(err, null, 2));
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  const handleChangeEmail = async () => {
    await signIn.reset();
    setCode("");
    setPassword("");
    setErrorMessage(null);
    setStep("email");
  };

  const onSubmit =
    step === "email"
      ? handleSendCode
      : step === "code"
        ? handleVerifyCode
        : handleResetPassword;

  const submitLabel =
    step === "email"
      ? "Send Reset Code"
      : step === "code"
        ? "Verify Code"
        : "Reset Password";

  const submittingLabel =
    step === "email"
      ? "Sending…"
      : step === "code"
        ? "Verifying…"
        : "Resetting…";

  const heading =
    step === "email"
      ? "Forgot\nPassword?"
      : step === "code"
        ? "Enter code"
        : "New password";

  const subtitle =
    step === "email"
      ? "No worries! Enter your email and we'll send you a reset code."
      : step === "code"
        ? `We emailed a reset code to ${email.trim()}. Enter the code when prompted.`
        : "Choose a new password for your account.";

  const field = useMemo(() => {
    switch (step) {
      case "code":
        return {
          icon: "keyboard" as const,
          value: code,
          onChangeText: setCode,
          placeholder: "Enter the code",
          keyboardType: "number-pad" as const,
          textContentType: "oneTimeCode" as const,
          autoComplete: "one-time-code" as const,
          maxLength: 6,
        };
      case "password":
        return {
          icon: "lock" as const,
          value: password,
          onChangeText: setPassword,
          placeholder: "New password",
          secure: true,
          textContentType: "newPassword" as const,
          autoComplete: "new-password" as const,
        };
      default:
        return {
          icon: "envelope" as const,
          value: email,
          onChangeText: setEmail,
          placeholder: "Enter your email",
          keyboardType: "email-address" as const,
          textContentType: "emailAddress" as const,
          autoComplete: "email" as const,
        };
    }
  }, [step, email, code, password]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <Stack.Screen options={{ headerTransparent: true, title: "" }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="chevron.backward"
          onPress={() => router.back()}
        />
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
          {settled && (
            <MascotScene
              scale={scale}
              focused={isFocused}
              // The code is out once we've left the email step.
              sent={step !== "email"}
            />
          )}

          {/* <DoodleNote
            text={"No worries!\nIt happens."}
            style={[styles.noteRight, { right: 14 * scale, top: 2 * scale }]}
          />
          <DoodleNote
            text={"We'll get you\nback on track!"}
            style={[styles.noteLeft, { left: 10 * scale, top: 142 * scale }]}
          />

          <MorphArrow
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
          <Text
            style={[styles.heading, step !== "email" && styles.headingCompact]}
          >
            {heading}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.fields}>
            <AuthField
              key={step}
              {...field}
              editable={!isSubmitting}
              onSubmitEditing={onSubmit}
            />
          </View>

          {errorMessage ? (
            <Text style={styles.error}>{errorMessage}</Text>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
            style={({ pressed }) => [
              styles.submit,
              isSubmitting && styles.submitDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.submitLabel}>
              {isSubmitting ? submittingLabel : submitLabel}
            </Text>
            {isSubmitting ? (
              <ActivityIndicator color={WHITE} style={styles.submitSpinner} />
            ) : (
              <Text style={styles.submitArrow}>→</Text>
            )}
          </Pressable>

          {step === "code" ? (
            <View style={styles.secondaryRow}>
              <Pressable
                onPress={handleResendCode}
                hitSlop={8}
                disabled={isSubmitting}
              >
                <Text style={styles.secondaryLink}>Resend code</Text>
              </Pressable>
              <Text style={styles.secondaryDot}>·</Text>
              <Pressable
                onPress={handleChangeEmail}
                hitSlop={8}
                disabled={isSubmitting}
              >
                <Text style={styles.secondaryLink}>Change email</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={goBack}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.loginWrap}
        >
          <Text style={styles.loginLink}>Back to Log in</Text>
        </Pressable>
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
  flightPath: {
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
    width: 92,
    transform: [{ rotate: "-8deg" }],
  },
  form: {
    paddingHorizontal: GUTTER,
    marginVertical: 30,
  },
  heading: {
    fontFamily: fonts.alanSans.black,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.2,
    color: INK,
    textAlign: "center",
  },
  headingCompact: {
    fontFamily: fonts.alanSans.extraBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.9,
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
    maxWidth: 330,
    marginTop: 10,
  },
  fields: {
    marginTop: 26,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: FIELD_BG,
    paddingHorizontal: 18,
    gap: 12,
  },
  fieldFocused: {
    borderColor: RUST,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: INK,
    fontFamily: fonts.alanSans.medium,
    paddingVertical: 0,
  },
  error: {
    fontFamily: fonts.alanSans.medium,
    fontSize: 13,
    lineHeight: 18,
    color: DANGER,
    marginTop: 10,
  },
  submit: {
    height: 48,
    borderRadius: 24,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
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
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  secondaryLink: {
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 14,
    color: MUTED,
  },
  secondaryDot: {
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 14,
    color: MUTED,
  },
  loginWrap: {
    alignSelf: "center",
    marginBottom: 4,
    zIndex: 5,
  },
  loginLink: {
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 15,
    color: MUTED,
  },
});
