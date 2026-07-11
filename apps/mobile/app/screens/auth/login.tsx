import { GoogleSignInButton } from "@/components/ui/auth/GoogleSignInButton";
import { useSignIn } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";

import {
  Host,
  HStack,
  Section,
  SecureField,
  Text,
  TextField,
  useNativeState,
  VStack,
  Image as IconImage,
  Button,
  Divider,
  Rectangle,
} from "@expo/ui/swift-ui";
import {
  autocorrectionDisabled,
  border,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  cornerRadius,
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  multilineTextAlignment,
  onSubmit,
  padding,
  submitLabel,
  textContentType,
  textInputAutocapitalization,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { ThemedView } from "@/components/themed-view";
import FloatingLabelInput from "@/components/ui/auth/FloatingLabelInput";
import { useColors } from "@/constants/theme";
import { AppleSignInButton } from "@/components/ui/auth/AppleSignInButton";

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const colors = useColors();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = fetchStatus === "fetching";
  const [canSubmit, setCanSubmit] = useState<boolean>(false);

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
          } else {
            router.push(url as Href);
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
    <View style={{ flex: 1, backgroundColor: "#FFFEFE" }}>
      <View style={styles.hero}>
        <Image
          source={require("@/assets/images/temp-with-icon.png")}
          style={styles.image}
          contentFit="cover"
          contentPosition={{ bottom: "20%" }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      <Host matchContents={{ vertical: true }} style={styles.container}>
        <VStack spacing={24}>
          <VStack spacing={8}>
            <Text
              modifiers={[
                font({ size: 32, weight: "bold", design: "rounded" }),
                multilineTextAlignment("center"),
              ]}
            >
              Welcome back!
            </Text>

            <Text
              modifiers={[
                font({ size: 16 }),
                foregroundStyle("#666"),
                multilineTextAlignment("center"),
              ]}
            >
              Sign in to continue your presentation journey.
            </Text>
          </VStack>
        </VStack>
      </Host>

      <View style={{ padding: 20 }}>
        <FloatingLabelInput
          label="Email"
          value={emailAddress}
          onChangeText={setEmailAddress}
          keyboardType="email-address"
          autoCapitalize="none"
          focusedBorderColor={colors.colors.rust}
          focusedLabelColor={colors.colors.rust}
        />
        <FloatingLabelInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          isPassword
          focusedBorderColor={colors.colors.rust}
          focusedLabelColor={colors.colors.rust}
        />
      </View>

      <Host matchContents={{ vertical: true }} style={styles.wrapper}>
        <VStack spacing={20}>
          <Button
            modifiers={[
              buttonStyle("glassProminent"),
              controlSize("extraLarge"),
              tint(colors.colors.rust),
              buttonBorderShape("capsule"),
            ]}
            onPress={handleSubmit}
          >
            <Text
              modifiers={[
                frame({
                  maxWidth: Infinity,
                  alignment: "center",
                }),
              ]}
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Text>
          </Button>

          <HStack spacing={12} alignment="center">
            <Rectangle
              modifiers={[
                frame({ maxWidth: Infinity, height: 1 }),
                foregroundStyle("#E5E7EB"),
              ]}
            />

            <Text
              modifiers={[
                font({ size: 14, weight: "medium" }),
                foregroundStyle("#6B7280"),
              ]}
            >
              OR
            </Text>

            <Rectangle
              modifiers={[
                frame({ maxWidth: Infinity, height: 1 }),
                foregroundStyle("#E5E7EB"),
              ]}
            />
          </HStack>
        </VStack>
      </Host>
      <View style={{ paddingHorizontal: 30, marginTop: 20 }}>
        <GoogleSignInButton logoSource={require("@/assets/icons/google.png")} />
        <AppleSignInButton />
      </View>
      <Host matchContents={{ vertical: true }} style={styles.wrapper}>
        <VStack spacing={4}>
          <Text modifiers={[font({ size: 14 }), foregroundStyle("#666")]}>
            Don&apos;t have an account?
          </Text>

          <Link href="/(unauthenticated)/signup" asChild>
            <Button
              label="Sign up"
              modifiers={[
                buttonStyle("plain"),
                font({ size: 14, weight: "semibold" }),
              ]}
            />
          </Link>
        </VStack>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: -30,
    marginHorizontal: 30,
  },

  wrapper: {
    marginHorizontal: 20,
  },

  hero: {
    flex: 0.9,
    overflow: "visible",
  },

  image: {
    width: "100%",
    height: "100%",
    alignSelf: "center",
  },

  title: {
    marginBottom: 8,
  },
  label: {
    fontWeight: "600",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  linkContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
    alignItems: "center",
  },
  error: {
    color: "#d32f2f",
    fontSize: 12,
    marginTop: -8,
  },
  debug: {
    fontSize: 10,
    opacity: 0.5,
    marginTop: 8,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
});
