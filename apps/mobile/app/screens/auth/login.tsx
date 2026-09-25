import { useSignIn } from "@clerk/expo";
import { Stack, useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { memo, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  useWindowDimensions,
  View,
} from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { AppleSignInButton } from "@/components/ui/auth/AppleSignInButton";
import { GoogleSignInButton } from "@/components/ui/auth/GoogleSignInButton";
import AnimatedMascot from "@/components/ui/animated-mascot";
import OrganicBlob from "@/components/ui/organic-blob";
import { fonts } from "@/constants/fonts";
import { LOGIN_MASCOT, MASCOTS } from "@/constants/mascots";
import { MorphArrow } from "@/screens/auth/components/morph-arrow";
import { useTransitionSettled } from "@/screens/auth/use-transition-settled";
import { mark } from "@/lib/frame-probe"; // TEMP profiling

const BACKGROUND = "#FBF3EA";
const INK = "#1C1A18";
const MUTED = "#8E887E";
const BORDER = "#E7DFD3";
const FIELD_BG = "#FFFDF9";
const RUST = "#B75C5C";
const WHITE = "#FFFFFF";
const DANGER = "#C0392B";

// The mascot composition is authored against a fixed design width and then
// scaled to the device, so tuning stays in one coordinate space.
const DESIGN_WIDTH = 416;
const MASCOT_AREA_HEIGHT = 250;
const GUTTER = 24;
// Global shrink applied to the mascot scene and the whole form, so everything
// scales down together without editing every value by 10%.
const COMPONENT_SCALE = 0.9;

// Every mascot Lottie draws its character at ~45% of its 720x720 canvas, so a
// square sized for a target character is `characterSize / CHARACTER_RATIO`.
// Entries below are authored by the character's centre in design units.
const CHARACTER_RATIO = 0.45;

type MascotPlacement = {
  /** Visible character size in design units. */
  character: number;
  /** Character centre in design units. */
  cx: number;
  cy: number;
  zIndex: number;
};

// Central cream mascot (the hero) plus the colourful blobs layered around it.
// Ordered by z-index so the front blobs partially occlude the ones behind.
const CREAM_MASCOT: MascotPlacement = {
  character: 160,
  cx: 209,
  cy: 138,
  zIndex: 15,
};

// `blue` and `purple` sit in front of the cream hero (higher z) so they
// overlap its lower body, while green/pink/yellow tuck in behind it. The
// blobs are kept low and to the sides so the cream mascot's face stays clear.
const SURROUNDING_MASCOTS = [
  { key: "pink", character: 106, cx: 75, cy: 114, zIndex: 3 },
  { key: "yellow", character: 98, cx: 318, cy: 142, zIndex: 3 },
  { key: "blue", character: 104, cx: 66, cy: 188, zIndex: 12 },
  { key: "purple", character: 100, cx: 334, cy: 196, zIndex: 12 },
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

interface LoginFieldProps {
  icon: "envelope" | "lock";
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: "default" | "email-address";
  textContentType?: "emailAddress" | "password" | "newPassword";
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}

/**
 * A rounded, minimal auth field: leading icon, placeholder, optional password
 * visibility toggle. Presentational only — the caller owns the value.
 */
export const LoginField = memo(function LoginField({
  icon,
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType = "default",
  textContentType,
  autoFocus,
  onSubmitEditing,
}: LoginFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <FontAwesome6 name={icon} iconStyle="solid" size={16} color={MUTED} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        secureTextEntry={secure && hidden}
        keyboardType={keyboardType}
        textContentType={textContentType}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="none"
        autoCorrect={false}
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
            size={17}
            color={MUTED}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

/**
 * The hero mascot and its surrounding blobs. Memoized and given a `scale`
 * derived from the device width so typing in the form never re-renders or
 * restarts the Lottie animations.
 */
const MascotScene = memo(function MascotScene({
  scale,
  focused,
}: {
  scale: number;
  focused: boolean;
}) {
  // A fixed shared value: the mascots keep their pose (no morph here) while
  // still going through the same AnimatedMascot transform pipeline.
  const still = useSharedValue(0);

  const blobs = useMemo(
    () =>
      SURROUNDING_MASCOTS.map((blob) => {
        const { size, position } = mascotLayout(blob, scale);
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

  const cream = useMemo(() => mascotLayout(CREAM_MASCOT, scale), [scale]);

  return (
    <View
      pointerEvents="none"
      style={{
        width: DESIGN_WIDTH * scale,
        height: MASCOT_AREA_HEIGHT * scale,
        alignSelf: "center",
      }}
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

      {/* Rendered through lottie-ios (no state machine) so the idle animation
          loops continuously like its surrounding blobs. */}
      <AnimatedMascot
        onLoaded={() => mark("hero:lottie loaded")} /* TEMP profiling */
        source={LOGIN_MASCOT}
        size={cream.size}
        zIndex={CREAM_MASCOT.zIndex}
        progress={still}
        position={cream.position}
        paused={!focused}
      />
    </View>
  );
});

/**
 * Procedural ShapeSoup blobs that frame the screen. Geometry is generated once
 * per seed inside OrganicBlob; here we only fade the layer in on mount.
 */
const BackgroundBlobs = memo(function BackgroundBlobs({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 700 });
  }, [reveal]);

  const blobs = useMemo(
    () => [
      {
        seed: "login-peach",
        x: width - 150,
        y: -120,
        size: 300,
        color: "#F6E7D2",
        opacity: 0.7,
        rotation: -12,
      },
      {
        seed: "login-pink",
        x: -150,
        y: height - 170,
        size: 340,
        color: "#F7D3DE",
        opacity: 0.7,
        rotation: 80,
      },
      {
        seed: "login-green",
        x: width - 200,
        y: height - 280,
        size: 260,
        color: "#CDE8C8",
        opacity: 0.55,
        rotation: 200,
      },
      {
        seed: "login-mint",
        x: -130,
        y: -90,
        size: 220,
        color: "#D3EBDD",
        opacity: 0.4,
        rotation: 20,
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

/** Handwritten-style doodle notes surrounding the mascot. */
const DoodleNote = memo(function DoodleNote({
  text,
  style,
}: {
  text: string;
  style: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.doodleNote, style]}>{text}</Text>;
});

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const isFocused = useIsFocused();
  const settled = useTransitionSettled();
  mark("login:render"); // TEMP profiling
  useEffect(() => { mark("login:mounted"); }, []);
  useEffect(() => { if (settled) mark("login:settled->mascots mount"); }, [settled]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = fetchStatus === "fetching";

  // Scale the fixed 416-wide design to the device. Height is also considered so
  // the mascot shrinks on short iPhones instead of pushing the form off-screen;
  // the upper clamp keeps tablets/landscape from blowing it up.
  const scale = useMemo(
    () => Math.min(width / DESIGN_WIDTH, height / 900, 1.15) * COMPONENT_SCALE,
    [width, height],
  );

  // A single static shared value for the decorative arrows so MorphArrow can be
  // reused without any morph animation (progress stays at 0). `from` and `to`
  // are identical, so the arrow simply holds its position.
  const arrowProgress = useSharedValue(0);
  const arrowLeftFrom = useMemo(
    () => ({ left: 102 * scale, top: scale - 10 }),
    [scale],
  );
  const arrowRightFrom = useMemo(
    () => ({ left: width - 170 * scale, top: 20 * scale }),
    [width, scale],
  );

  const handleSubmit = async () => {
    setErrorMessage(null);

    const { error } = await signIn.password({
      emailAddress,
      password,
    });
    if (error) {
      console.error(JSON.stringify(error, null, 2));
      setErrorMessage(
        errors.fields.identifier?.message ??
          errors.fields.password?.message ??
          "Something went wrong. Please check your details and try again.",
      );
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          // Handle session tasks
          // See https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks
          if (session?.currentTask) {
            console.log(session?.currentTask);
            return;
          }

          // If no session tasks, navigate the signed-in user to the home page
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            window.location.href = url;
          }
        },
      });
    } else if (signIn.status === "needs_second_factor") {
      // See https://clerk.com/docs/guides/development/custom-flows/authentication/multi-factor-authentication
    } else if (signIn.status === "needs_client_trust") {
      // For other second factor strategies,
      // see https://clerk.com/docs/guides/development/custom-flows/authentication/client-trust
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === "email_code",
      );

      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
      }
      router.push({
        pathname: "/(unauthenticated)/verify",
        params: {
          flow: "signIn",
        },
      });
    } else {
      // Check why the sign-in is not complete
      console.error("Sign-in attempt not complete:", signIn);
    }
  };

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

      <BackgroundBlobs width={width} height={height} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.flex,
            styles.content,
            {
              paddingTop: insets.top + 4,
              paddingBottom: Math.max(insets.bottom, 14) + 6,
            },
          ]}
        >
          <View style={[styles.hero, { height: MASCOT_AREA_HEIGHT * scale }]}>
            {settled && <MascotScene scale={scale} focused={isFocused} />}

            <DoodleNote
              text={"Good\nto see you\nagain!"}
              style={[styles.noteLeft, { left: 20 * scale, top: scale }]}
            />
            <DoodleNote
              text={"Let's\ncreate\nsomething\ngreat!"}
              style={[styles.noteRight, { right: 12 * scale, top: 10 * scale }]}
            />

            <MorphArrow
              progress={arrowProgress}
              from={arrowLeftFrom}
              to={arrowLeftFrom}
              baseRotation={38}
            />
            <MorphArrow
              progress={arrowProgress}
              from={arrowRightFrom}
              to={arrowRightFrom}
              baseRotation={-40}
              flip
            />
          </View>

          <View style={styles.form}>
            <View style={styles.headingRow}>
              <Text style={styles.heading}>Welcome back!</Text>
              <View style={styles.dashes}>
                <View style={[styles.dash, styles.dashTop]} />
                <View style={[styles.dash, styles.dashBottom]} />
              </View>
            </View>

            <Text style={styles.subtitle}>
              Sign in to continue your presentation journey.
            </Text>

            <View style={styles.fields}>
              <LoginField
                icon="envelope"
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder="Email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <LoginField
                icon="lock"
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secure
                textContentType="password"
              />
            </View>

            <Pressable
              onPress={() => router.push("/(unauthenticated)/forgot-password")}
              hitSlop={8}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>

            {errorMessage ? (
              <Text style={styles.error}>{errorMessage}</Text>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.signIn,
                isSubmitting && styles.signInDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.signInLabel}>
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Text>
              <Text style={styles.signInArrow}>→</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <GoogleSignInButton
              logoSource={require("@/assets/icons/google.png")}
              cornerRadius={22}
              height={44}
            />
            <AppleSignInButton cornerRadius={22} height={44} />

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>
                Don&apos;t have an account?{" "}
              </Text>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  // Re-enter the onboarding screen already morphed into its
                  // create-account state, and remember we came from login so
                  // its back button returns here.
                  router.push({
                    pathname: "/(unauthenticated)",
                    params: { createAccount: "1", from: "login" },
                  })
                }
              >
                <Text style={styles.signupLink}>Sign up</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    marginVertical: 20,
  },
  content: {
    flexGrow: 1,
  },
  hero: {
    width: "100%",
  },
  form: {
    paddingHorizontal: GUTTER,
    marginTop: 20,
  },
  headingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  heading: {
    fontFamily: fonts.alanSans.extraBold,
    fontSize: 29,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: INK,
    textAlign: "center",
  },
  dashes: {
    width: 24,
    height: 24,
    marginLeft: 7,
    justifyContent: "center",
  },
  dash: {
    position: "absolute",
    width: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F4CF66",
  },
  dashTop: {
    top: 5,
    right: 0,
    transform: [{ rotate: "-32deg" }],
  },
  dashBottom: {
    bottom: 4,
    left: 0,
    transform: [{ rotate: "-32deg" }],
  },
  subtitle: {
    fontFamily: fonts.alanSans.regular,
    fontSize: 14,
    lineHeight: 18,
    color: MUTED,
    textAlign: "center",
    marginTop: 4,
  },
  fields: {
    marginTop: 16,
    gap: 10,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: FIELD_BG,
    paddingHorizontal: 16,
    gap: 10,
  },
  fieldFocused: {
    borderColor: RUST,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: INK,
    fontFamily: fonts.alanSans.medium,
    paddingVertical: 0,
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: 6,
  },
  forgot: {
    fontFamily: fonts.alanSans.medium,
    fontSize: 13,
    color: MUTED,
  },
  error: {
    fontFamily: fonts.alanSans.medium,
    fontSize: 12,
    lineHeight: 17,
    color: DANGER,
    marginTop: 8,
  },
  signIn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  signInDisabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.9,
  },
  signInLabel: {
    fontFamily: fonts.alanSans.bold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: WHITE,
  },
  signInArrow: {
    position: "absolute",
    right: 20,
    fontFamily: fonts.alanSans.bold,
    fontSize: 20,
    lineHeight: 22,
    color: WHITE,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 13,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },
  dividerText: {
    marginHorizontal: 12,
    fontFamily: fonts.alanSans.medium,
    fontSize: 12,
    letterSpacing: 1,
    color: MUTED,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  signupText: {
    fontFamily: fonts.alanSans.regular,
    fontSize: 14,
    color: MUTED,
  },
  signupLink: {
    fontFamily: fonts.alanSans.bold,
    fontSize: 14,
    color: MUTED,
  },
  doodleNote: {
    position: "absolute",
    fontFamily: fonts.kalam.regular,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
    color: MUTED,
  },
  noteLeft: {
    width: 84,
    transform: [{ rotate: "-9deg" }],
  },
  noteRight: {
    width: 86,
    transform: [{ rotate: "9deg" }],
  },
});
