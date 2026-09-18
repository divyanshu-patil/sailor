import {
  StyleSheet,
  TextInput,
  Text as RNText,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignIn, useSignUp } from "@clerk/expo";

import { useLocalSearchParams, useRouter } from "expo-router";
import { Host, Text, VStack, Button } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { fonts } from "@/constants/fonts";

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
  const [code, setCode] = useState("");
  const { flow } = useLocalSearchParams<{
    flow: "signIn" | "signUp";
  }>();

  if (!flow) {
    router.replace("/(unauthenticated)/login");
    return null;
  }

  const mode = flow as "signIn" | "signUp";

  const fetchStatus = mode === "signIn" ? signInFetchStatus : signUpFetchStatus;

  const codeError =
    mode === "signIn" ? signInErrors.fields.code : signUpErrors.fields.code;

  const navigateHome = (
    session: any,
    decorateUrl: (path: string) => string,
  ) => {
    if (session?.currentTask) {
      console.log(session?.currentTask);
      return;
    }
    const url = decorateUrl("/");
    if (url.startsWith("http")) {
      window.location.href = url;
    }
  };

  const handleVerify = async () => {
    if (mode === "signIn") {
      await signIn.mfa.verifyEmailCode({ code });

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) =>
            navigateHome(session, decorateUrl),
        });
      } else {
        console.error("Sign-in attempt not complete:", signIn);
      }
    } else {
      await signUp.verifications.verifyEmailCode({ code });

      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: ({ session, decorateUrl }) =>
            navigateHome(session, decorateUrl),
        });
      } else {
        console.error("Sign-up attempt not complete:", signUp);
      }
    }
  };

  const handleResend = () => {
    if (mode === "signIn") {
      signIn.mfa.sendEmailCode();
    } else {
      signUp.verifications.sendEmailCode();
    }
  };

  const formatCode = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);

    if (digits.length <= 3) return digits;

    return `${digits.slice(0, 3)}  ${digits.slice(3)}`;
  };
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.flex}>
          <Host matchContents={{ vertical: true }}>
            <VStack spacing={15}>
              <VStack
                modifiers={[
                  frame({
                    maxWidth: Infinity,
                    alignment: "leading",
                  }),
                ]}
              >
                <Text
                  modifiers={[
                    font({
                      family: fonts.alanSans.bold,
                      design: "rounded",
                      size: 30,
                    }),
                  ]}
                >
                  Verify your account
                </Text>
              </VStack>

              <VStack
                modifiers={[
                  frame({
                    maxWidth: Infinity,
                    alignment: "leading",
                  }),
                ]}
              >
                <Text
                  modifiers={[
                    foregroundStyle("#44444ec5"),
                    font({
                      family: fonts.alanSans.semiBold,
                      design: "rounded",
                      size: 22,
                    }),
                  ]}
                >
                  Enter the verification code we sent to your provided email.
                </Text>
              </VStack>
            </VStack>
          </Host>
          <TextInput
            style={styles.input}
            value={formatCode(code)}
            placeholder="000  000"
            placeholderTextColor="#666666"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={8}
            onChangeText={(text) => {
              // Keep only digits
              const digits = text.replace(/\D/g, "");
              setCode(digits);
            }}
          />

          <Host matchContents={{ vertical: true }}>
            <VStack spacing={2}>
              <Button
                label="Didn't receive a code?"
                modifiers={[
                  frame({ maxWidth: Infinity, alignment: "leading" }),
                  buttonStyle("plain"),
                  foregroundStyle("#B75C5C"),
                  font({
                    family: fonts.alanSans.semiBold,
                    design: "rounded",
                    size: 16,
                  }),
                ]}
                onPress={handleResend}
              />
            </VStack>
          </Host>
          {codeError && (
            <RNText style={styles.error}>Oops! That&apos;s incorrect.</RNText>
          )}
        </View>
        <View style={styles.footer}>
          <Host matchContents={{ vertical: true }}>
            <Button
              modifiers={[
                frame({ maxWidth: Infinity }),
                buttonStyle("glassProminent"),
                controlSize("extraLarge"),
                tint("#B75C5C"),
                buttonBorderShape("capsule"),
                disabled(fetchStatus === "fetching"),
              ]}
              onPress={handleVerify}
            >
              <Text
                modifiers={[
                  frame({
                    maxWidth: Infinity,
                    alignment: "center",
                  }),
                ]}
              >
                {fetchStatus === "fetching" ? "Verifying…" : "Verify"}
              </Text>
            </Button>
          </Host>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, marginTop: 25 },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontFamily: fonts.alanSans.regular,
  },
  button: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: { color: "#0a7ea4", fontWeight: "600" },
  error: {
    color: "#d32f2f",
    fontSize: 15,
    backgroundColor: "#f7d6d6",
    padding: 10,
    borderRadius: 50,
    alignSelf: "flex-start",
    fontFamily: fonts.alanSans.semiBold,
  },
  flex: {
    flex: 1,
    gap: 12,
  },

  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
    gap: 18,
  },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
});
