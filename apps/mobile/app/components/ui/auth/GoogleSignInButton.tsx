import { useState } from "react";
import { useAuth } from "@clerk/expo";
import { useSignInWithGoogle } from "@clerk/expo/google";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { haptics } from "@/lib/haptics";

/**
 * Sign in with Google — Expo + Clerk
 * -----------------------------------------------------------------------
 * Google doesn't ship a native system button component the way Apple does
 * (via expo-apple-authentication), so this is a custom button built to
 * Google's own "Sign in with Google" branding guidelines:
 *   https://developers.google.com/identity/branding-guidelines
 *
 * Key rules from those guidelines this follows:
 *   - Button fill is one of the two approved colors: white (#FFFFFF) or
 *     Google blue (#4285F4) — no custom brand colors.
 *   - Call-to-action copy is exactly "Sign in with Google",
 *     "Sign up with Google", or "Continue with Google".
 *   - The Google "G" icon should never appear alone without the text —
 *     pass `logoSource` once you have the approved asset and it renders
 *     next to the label; until then the button still works fine text-only.
 *   - The button must be at least as prominent as other sign-in options.
 *
 * Drop your Google "G" logo in as `logoSource` when it's ready, e.g.:
 *   <GoogleSignInButton logoSource={require("../assets/google-logo.png")} />
 * Pre-approved logo assets: https://developers.google.com/identity/branding-guidelines
 *
 * Setup required (native Google sign-in, no browser redirect):
 *   1. npx expo install expo-crypto
 *   2. Create OAuth 2.0 credentials in Google Cloud Console (iOS, Android,
 *      and Web client IDs)
 *   3. Set the Web Client ID + secret in the Clerk Dashboard, and register
 *      your iOS/Android app on Clerk's "Native applications" page
 *   4. Requires a development build — native sign-in does not work in Expo Go
 */

/**
 * A connection that dropped mid-flow — typically Google's token exchange going
 * out on a pooled connection that died while the sign-in sheet was up (iOS
 * reports it as NSURLErrorNetworkConnectionLost, -1005). It happens most on a
 * second sign-in a few minutes after the first, and a fresh attempt succeeds.
 */
const isDroppedConnection = (err: any) =>
  /network connection was lost|timed out|-1005|-1001/i.test(
    `${err?.message ?? ""} ${err?.code ?? ""}`,
  );

const isCancelled = (err: any) =>
  err?.code === "SIGN_IN_CANCELLED" || err?.code === "-5";

interface GoogleSignInButtonProps {
  onSignInComplete?: () => void;
  showDivider?: boolean;
  /** Google's approved "G" logo asset — required by their guidelines once you add one */
  logoSource?: ImageSourcePropType;
  /** Only white and Google blue are brand-approved fill colors */
  variant?: "white";
  /** Maps to Google's three approved call-to-action strings */
  label?:
    | "Sign in with Google"
    | "Sign up with Google"
    | "Continue with Google";
  /** Corner radius in points. Defaults to Google's 8. */
  cornerRadius?: number;
  /** Fixed height in points. Defaults to the 46pt minimum touch target. */
  height?: number;
}

export function GoogleSignInButton({
  onSignInComplete,
  showDivider = false,
  logoSource,
  variant = "white",
  label = "Sign in with Google",
  cornerRadius = 8,
  height = 46,
}: GoogleSignInButtonProps) {
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const { isLoaded } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Native Google sign-in via Clerk is supported on iOS and Android only.
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }

  // One retry for a dropped connection: the failure is the network's, not the
  // person's, so they shouldn't have to start over by hand.
  const authenticate = async () => {
    try {
      return await startGoogleAuthenticationFlow();
    } catch (err) {
      if (!isDroppedConnection(err)) throw err;
      return await startGoogleAuthenticationFlow();
    }
  };

  const handleGoogleSignIn = async () => {
    // Clerk answers "no session" without a word while it's still loading —
    // the tap that seemed to do nothing. The button waits for it instead.
    if (busy || !isLoaded) return;
    setBusy(true);
    try {
      const { createdSessionId, setActive } = await authenticate();
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
      if (isCancelled(err)) return;
      haptics.error();
      Alert.alert(
        "Couldn't sign in with Google",
        isDroppedConnection(err)
          ? "The connection dropped. Check your internet and try again."
          : err.message || "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const isWhite = variant === "white";

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.googleButton,
          isWhite && styles.googleButtonWhite,
          { borderRadius: cornerRadius, minHeight: height, height },
        ]}
        onPress={handleGoogleSignIn}
        activeOpacity={0.85}
        disabled={busy || !isLoaded}
        accessibilityState={{ busy: busy || !isLoaded }}
      >
        {busy || !isLoaded ? (
          <ActivityIndicator color={isWhite ? "#3C4043" : "#FFFFFF"} />
        ) : (
          <>
            {logoSource ? (
              <Image
                source={logoSource}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : null}
            <Text
              style={[
                styles.googleButtonText,
                isWhite && styles.googleButtonTextDark,
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {showDivider && (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: "#4285F4",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46, // Google's recommended minimum touch target
    marginBottom: 10,
    gap: 5,
  },
  googleButtonWhite: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0", // Google's standard neutral border for the white variant
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  googleButtonTextDark: {
    color: "#3C4043", // Google's standard button label color on white
  },
  logo: {
    width: 15,
    height: 15,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ccc",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666",
  },
});
