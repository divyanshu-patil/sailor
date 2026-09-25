import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSignUp } from "@clerk/expo";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";

import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";
import { LoginField } from "@/screens/auth/login";
import { EMAIL_REGEX, MIN_PASSWORD_LENGTH } from "@/screens/auth/validation";
import {
  friendlyVerifyError,
  OTP_LENGTH,
  OtpInput,
  RESEND_SECONDS,
} from "@/screens/auth/verify";

const INK = "#1C1A18";
const MUTED = "#8E887E";
const DANGER = "#C0392B";

type Step = "email" | "password" | "code";

/** Fades a step in on a shared value. A layout entrance here started while the
 *  sheet was still presenting and stuck at zero — an empty sheet. */
function StepFade({ children }: { children: ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, { duration: 200 }));
  }, [shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View style={[styles.body, fade]}>{children}</Animated.View>;
}

const COPY: Record<Step, { title: string; subtitle: (email: string) => string }> = {
  email: {
    title: "What's your email?",
    subtitle: () => "We'll send a code to check it's you.",
  },
  password: {
    title: "Pick a password",
    subtitle: () => `At least ${MIN_PASSWORD_LENGTH} characters.`,
  },
  code: {
    title: "Check your inbox",
    subtitle: (email) => `Enter the code we sent to ${email}.`,
  },
};

/**
 * Sign up with email, in one native sheet: email, then password, then the code
 * Clerk mails. The sheet sizes to its content, so each step swaps what's inside
 * and the sheet follows. Once the code checks out the session goes live and the
 * router swaps the signed-out stack away — the sheet with it.
 */
export default function EmailSignupSheet() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const busy = fetchStatus === "fetching";

  useEffect(() => {
    if (step !== "code" || secondsLeft <= 0) return;
    const timeout = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timeout);
  }, [step, secondsLeft]);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const submitEmail = () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("That doesn't look like an email address.");
      return;
    }
    go("password");
  };

  const submitPassword = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setError(null);
    try {
      const { error: createError } = await signUp.create({
        emailAddress: email.trim(),
        password,
      });
      if (createError) {
        const emailError = errors.fields.emailAddress?.message;
        if (emailError) {
          // The email is what's wrong, so take them back to it.
          setStep("email");
          setError(emailError);
        } else {
          setError(
            errors.fields.password?.message ??
              "Something went wrong. Please try again.",
          );
        }
        return;
      }
      await signUp.verifications.sendEmailCode();
      setSecondsLeft(RESEND_SECONDS);
      go("code");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const submitCode = useCallback(
    async (value: string) => {
      if (value.length < OTP_LENGTH || busy) return;
      setError(null);
      try {
        const { error: verifyError } =
          await signUp.verifications.verifyEmailCode({ code: value });
        if (verifyError) {
          haptics.error();
          setError(friendlyVerifyError(verifyError));
          return;
        }
        if (signUp.status === "complete") {
          haptics.success();
          await signUp.finalize();
        } else {
          setError("Something went wrong. Please try again.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    },
    [signUp, busy],
  );

  const changeCode = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    // Filled in, or pasted whole from the email: check it straight away.
    if (digits.length === OTP_LENGTH) void submitCode(digits);
  };

  const resend = async () => {
    if (busy || secondsLeft > 0) return;
    setError(null);
    try {
      await signUp.verifications.sendEmailCode();
      setSecondsLeft(RESEND_SECONDS);
    } catch {
      setError("We couldn't resend the code. Please try again.");
    }
  };

  const back = step === "password" ? "email" : step === "code" ? "password" : null;
  const copy = COPY[step];

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        {back ? (
          <Pressable
            onPress={() => go(back)}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <FontAwesome6 name="chevron-left" iconStyle="solid" size={16} color={INK} />
          </Pressable>
        ) : null}
        <Text style={styles.stepCount}>
          {`${["email", "password", "code"].indexOf(step) + 1} of 3`}
        </Text>
      </View>

      {/* Keyed by step, so each step's content fades in as the sheet resizes
          to it. */}
      <StepFade key={step}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle(email.trim())}</Text>

        {step === "email" ? (
          <LoginField
            icon="envelope"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoFocus
            onSubmitEditing={submitEmail}
          />
        ) : step === "password" ? (
          <LoginField
            icon="lock"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            placeholder="Password"
            secure
            textContentType="newPassword"
            autoFocus
            onSubmitEditing={submitPassword}
          />
        ) : (
          <OtpInput code={code} onChangeText={changeCode} editable={!busy} autoFocus />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === "code" ? (
          <Pressable onPress={resend} disabled={secondsLeft > 0 || busy} hitSlop={8}>
            <Text style={[styles.resend, secondsLeft > 0 && styles.resendWaiting]}>
              {secondsLeft > 0
                ? `Resend code in 0:${String(secondsLeft).padStart(2, "0")}`
                : "Resend code"}
            </Text>
          </Pressable>
        ) : null}
      </StepFade>

      <Pressable
        onPress={
          step === "email"
            ? submitEmail
            : step === "password"
              ? submitPassword
              : () => void submitCode(code)
        }
        disabled={busy}
        style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryLabel}>
            {step === "password" ? "Create account" : step === "code" ? "Verify" : "Continue"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 20,
    backgroundColor: "#FBF3EA",
  },
  header: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    position: "absolute",
    left: 0,
  },
  stepCount: {
    fontFamily: fonts.alanSans.medium,
    fontSize: 13,
    color: MUTED,
  },
  body: {
    gap: 14,
  },
  title: {
    fontFamily: fonts.alanSans.bold,
    fontSize: 26,
    letterSpacing: -0.6,
    color: INK,
  },
  subtitle: {
    fontFamily: fonts.alanSans.medium,
    fontSize: 15,
    lineHeight: 20,
    color: MUTED,
    marginTop: -8,
    marginBottom: 4,
  },
  error: {
    fontFamily: fonts.alanSans.medium,
    fontSize: 14,
    color: DANGER,
  },
  resend: {
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 14,
    color: INK,
    textAlign: "center",
  },
  resendWaiting: {
    color: MUTED,
  },
  primary: {
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryLabel: {
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
});
