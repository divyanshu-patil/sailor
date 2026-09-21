import { useSignInWithApple } from "@clerk/expo/apple";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import { haptics } from "@/lib/haptics";

/**
 * Sign in with Apple — Expo + Clerk
 * -----------------------------------------------------------------------
 * This renders Apple's SYSTEM-PROVIDED button (via expo-apple-authentication)
 * rather than a hand-rolled TouchableOpacity. Per Apple's Human Interface
 * Guidelines, the system button is preferred because it guarantees:
 *   - An Apple-approved appearance
 *   - Correct title/logo proportions at any size
 *   - Automatic title translation based on device locale
 *   - Built-in VoiceOver support
 *
 * Apple Sign In is natively supported on iOS only (there's no native
 * Android SDK from Apple, and Clerk's useSignInWithApple() hook is
 * iOS-only) — the component simply renders nothing elsewhere. If you need
 * an Android entry point too, pair this with Clerk's useSSO() hook using
 * the "oauth_apple" strategy as a browser-based fallback.
 *
 * One-time setup required:
 *   1. npx expo install expo-apple-authentication expo-crypto
 *   2. Add expo-apple-authentication to the "plugins" array in app.json
 *   3. Set `ios.usesAppleSignIn: true` in your app config
 *   4. Register your iOS app's Team ID + Bundle ID on Clerk's
 *      "Native applications" dashboard page
 *   5. Requires a development build — Apple auth does not work in Expo Go
 *
 * Required by App Store Review Guideline 4.8: any app offering third-party
 * social sign-in must also offer Sign in with Apple on iOS.
 */

interface AppleSignInButtonProps {
  onSignInComplete?: () => void;
  /** Maps to Apple's three approved button titles — pick whichever matches your flow's wording */
  variant?: "sign_in" | "sign_up" | "continue";
  /** Per Apple HIG: use "black" or "white_outline" on light backgrounds, "white" on dark backgrounds */
  buttonStyle?: "black" | "white" | "white_outline";
  /** Match the corner radius of your other auth buttons */
  cornerRadius?: number;
  /** 44pt is Apple's recommended default height; HIG minimum is 30pt */
  height?: number;
}

const BUTTON_TYPES = {
  sign_in: AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN,
  sign_up: AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP,
  continue: AppleAuthentication.AppleAuthenticationButtonType.CONTINUE,
} as const;

const BUTTON_STYLES = {
  black: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK,
  white: AppleAuthentication.AppleAuthenticationButtonStyle.WHITE,
  white_outline:
    AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE,
} as const;

export function AppleSignInButton({
  onSignInComplete,
  variant = "sign_in",
  buttonStyle = "black",
  cornerRadius = 8,
  height = 44,
}: AppleSignInButtonProps) {
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const router = useRouter();
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Guards against iOS versions/devices where Apple auth isn't offered,
    // even though we're already filtering to Platform.OS === "ios" below.
    AppleAuthentication.isAvailableAsync().then(setIsAvailable);
  }, []);

  // Only render on iOS — this is a native-only feature.
  if (Platform.OS !== "ios" || !isAvailable) {
    return null;
  }

  const handleAppleSignIn = async () => {
    try {
      const { createdSessionId, setActive } =
        await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        haptics.successBig();
        await setActive({ session: createdSessionId });
        if (onSignInComplete) {
          onSignInComplete();
        } else {
          router.replace("/");
        }
      }
    } catch (err: any) {
      // User dismissed the Apple auth sheet — not a real error.
      if (err.code === "ERR_REQUEST_CANCELED") return;
      haptics.error();
      Alert.alert(
        "Error",
        err.message || "An error occurred during Apple sign-in",
      );
    }
  };

  return (
    <View style={styles.container}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={BUTTON_TYPES[variant]}
        buttonStyle={BUTTON_STYLES[buttonStyle]}
        cornerRadius={cornerRadius}
        style={[styles.button, { height }]}
        onPress={handleAppleSignIn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 10,
  },
  button: {
    width: "100%",
  },
});
