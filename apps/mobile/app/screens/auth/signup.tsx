import { GoogleSignInButton } from "@/components/ui/auth/GoogleSignInButton";
import { useAuth, useSignUp } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import {
  Host,
  HStack,
  SecureField,
  Text,
  TextField,
  useNativeState,
  VStack,
  Image as IconImage,
  Button,
  Rectangle,
} from "@expo/ui/swift-ui";
import {
  autocorrectionDisabled,
  border,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  cornerRadius,
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

export default function Page() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const emailAddress = useNativeState("");
  const password = useNativeState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = fetchStatus === "fetching";

  const handleSubmit = async () => {
    setErrorMessage(null);
    try {
      const { error } = await signUp.create({
        emailAddress: emailAddress.value,
        password: password.value,
      });

      if (error) {
        console.error(JSON.stringify(error, null, 2));
        setErrorMessage(
          errors.fields.emailAddress?.message ??
            errors.fields.password?.message ??
            "Something went wrong. Please check your details and try again.",
        );
        return;
      }

      await signUp.verifications.sendEmailCode();
      // Reuse the same verification screen for both sign-in and sign-up.
      // Clerk decides which flow is currently active.
      router.push("/(unauthenticated)/verify" as Href);
    } catch (err) {
      console.error("Sign up error:", JSON.stringify(err, null, 2));
      setErrorMessage("Something went wrong. Please try again.");
    }
  };

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFEFE" }}>
      <View style={styles.hero}>
        <Image
          source={require("@/assets/images/temp-script-hold.png")}
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
              Create account!
            </Text>

            <Text
              modifiers={[
                font({ size: 16 }),
                foregroundStyle("#666"),
                multilineTextAlignment("center"),
              ]}
            >
              Sign up to start your presentation journey.
            </Text>
          </VStack>

          <VStack spacing={5}>
            <VStack spacing={15}>
              <HStack
                spacing={5}
                modifiers={[
                  border({ width: 1.5, color: "#E5E7EB" }),
                  cornerRadius(2),
                ]}
              >
                <IconImage
                  systemName="envelope"
                  modifiers={[
                    padding({ horizontal: 12 }),
                    frame({ width: 50, alignment: "center" }),
                  ]}
                />
                <TextField
                  placeholder="name@example.com"
                  text={emailAddress}
                  modifiers={[
                    keyboardType("email-address"),
                    textInputAutocapitalization("never"),
                    textContentType("emailAddress"),
                    autocorrectionDisabled(),
                    submitLabel("next"),
                    padding({ vertical: 10 }),
                  ]}
                />
              </HStack>
              <HStack
                spacing={5}
                modifiers={[
                  border({ width: 1.5, color: "#E5E7EB" }),
                  cornerRadius(2),
                ]}
              >
                <IconImage
                  systemName="lock.fill"
                  modifiers={[
                    padding({ horizontal: 12 }),
                    frame({ width: 50, alignment: "center" }),
                  ]}
                />
                <SecureField
                  placeholder="Password"
                  text={password}
                  modifiers={[
                    textContentType("newPassword"),
                    submitLabel("done"),
                    onSubmit(handleSubmit),
                    padding({ vertical: 10 }),
                  ]}
                />
              </HStack>
            </VStack>
            {errorMessage && (
              <Text
                modifiers={[
                  frame({ maxWidth: Infinity, alignment: "topLeading" }),
                  font({ size: 14 }),
                  padding({ leading: 12 }),
                  foregroundStyle("#d32f2f"),
                ]}
              >
                {errorMessage}
              </Text>
            )}
          </VStack>

          <Button
            modifiers={[
              buttonStyle("glassProminent"),
              controlSize("extraLarge"),
              tint("#FF6347"),
              buttonBorderShape("capsule"),
            ]}
            onPress={handleSubmit}
          >
            <Text
              modifiers={[frame({ maxWidth: Infinity, alignment: "center" })]}
            >
              {isSubmitting ? "Creating account…" : "Sign Up"}
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

          <VStack>
            <GoogleSignInButton />
          </VStack>

          <VStack spacing={4}>
            <Text modifiers={[font({ size: 14 }), foregroundStyle("#666")]}>
              Already have an account?
            </Text>
            <Link href="/(unauthenticated)/login" asChild>
              <Button
                label="Sign in"
                modifiers={[
                  buttonStyle("plain"),
                  font({ size: 14, weight: "semibold" }),
                ]}
              />
            </Link>
          </VStack>
        </VStack>
      </Host>

      {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: -30,
    marginHorizontal: 30,
  },
  hero: {
    flex: 0.8,
    overflow: "visible",
  },
  image: {
    width: "100%",
    height: "100%",
    alignSelf: "center",
  },
});
