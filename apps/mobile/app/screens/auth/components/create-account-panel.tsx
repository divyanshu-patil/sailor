import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";
import { AppleSignInButton } from "@/components/ui/auth/AppleSignInButton";
import { GoogleSignInButton } from "@/components/ui/auth/GoogleSignInButton";
import { fonts } from "@/constants/fonts";

const INK = "#1C1A18";

const PILL_HEIGHT = 44;
const PILL_RADIUS = 22;

export function CreateAccountPanel() {
  return (
    <View style={styles.panel}>
      {/* Google */}
      <View style={styles.buttonWrapper}>
        <GoogleSignInButton
          logoSource={require("@/assets/icons/google.png")}
          cornerRadius={PILL_RADIUS}
          height={PILL_HEIGHT}
        />
      </View>

      {/* Apple */}
      <View style={styles.buttonWrapper}>
        <AppleSignInButton
          cornerRadius={PILL_RADIUS}
          height={PILL_HEIGHT}
        />
      </View>

      {/* Email */}
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.emailButton,
          pressed && styles.pressed,
        ]}
        onPress={() => router.push("/(unauthenticated)/(signup)/signup")}
      >
        <FontAwesome6
          name="envelope"
          iconStyle="solid"
          size={14}
          color={INK}
        />

        <Text style={styles.emailText}>
          Continue with Email
        </Text>
      </Pressable>

      <Text style={styles.terms}>
        By continuing, you agree to our{"\n"}
        <Text style={styles.termsLink}>
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text style={styles.termsLink}>
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    gap: 10
  },

  /*
   * Forces Google and Apple to occupy the exact same
   * width as the custom Email button.
   */
  buttonWrapper: {
    width: "100%",
    height: PILL_HEIGHT,
  },

  emailButton: {
    width: "100%",
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: "#E3DCD2",
    backgroundColor: "#FFFFFF",

    gap: 10,
  },

  pressed: {
    opacity: 0.85,
  },

  emailText: {
    color: INK,
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.2,
  },

  terms: {
    marginTop: 8,
    textAlign: "center",
    color: "#8E887E",
    fontFamily: fonts.alanSans.regular,
    fontSize: 12,
    lineHeight: 16,
  },

  termsLink: {
    color: "#6E6A63",
    fontFamily: fonts.alanSans.semiBold,
  },
});