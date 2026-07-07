import { useSignInWithGoogle } from "@clerk/expo/google";
import { Button, HStack, Image, Text } from "@expo/ui/swift-ui";
import {
  border,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  cornerRadius,
  frame,
  labelStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import {
  Alert,
  Platform,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
} from "react-native";

interface GoogleSignInButtonProps {
  onSignInComplete?: () => void;
  showDivider?: boolean;
}

export function GoogleSignInButton({
  onSignInComplete,
  showDivider = true,
}: GoogleSignInButtonProps) {
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const router = useRouter();

  // Only render on iOS and Android
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }
  const handleGoogleSignIn = async () => {
    try {
      const { createdSessionId, setActive } =
        await startGoogleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err: any) {
      if (err.code === "SIGN_IN_CANCELLED" || err.code === "-5") return;
      Alert.alert(
        "Error",
        err.message || "An error occurred during Google sign-in",
      );
    }
  };

  return (
    <>
      {/* <Button label="Sign In With Google" /> */}
      <Button
        onPress={handleGoogleSignIn}
        modifiers={[
          labelStyle("titleAndIcon"),
          buttonStyle("glassProminent"),
          controlSize("extraLarge"),
          buttonBorderShape("capsule"),
        ]}
      >
        <HStack>
          <Image systemName="g.circle.fill" />
          <Text
            modifiers={[
              frame({
                maxWidth: Infinity,
                alignment: "center",
              }),
            ]}
          >
            Sign In With Google
          </Text>
        </HStack>
      </Button>
      {/* <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
      >
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </TouchableOpacity> */}
    </>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    backgroundColor: "#4285F4",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
