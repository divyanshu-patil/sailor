import { StyleSheet, TextInput, View } from "react-native";
import { useSignupForm } from "./form-context";
import { MIN_PASSWORD_LENGTH } from "./types/types";
import { Host, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame } from "@expo/ui/swift-ui/modifiers";
import { fonts } from "@/constants/fonts";

export default function StepPassword() {
  const { passwordState, setPasswordState, isPasswordValid, errorMessage } =
    useSignupForm();

  const showHint = passwordState.length > 0 && !isPasswordValid;

  return (
    <View style={styles.container}>
      <Host matchContents={{ vertical: true }}>
        <VStack>
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
              Set a password
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
              At least {MIN_PASSWORD_LENGTH} characters.
            </Text>
          </VStack>
        </VStack>
      </Host>

      <TextInput
        placeholder="Password"
        value={passwordState}
        onChangeText={setPasswordState}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        returnKeyType="done"
        style={styles.input}
      />

      {/* Clerk CAPTCHA */}
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#666",
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontFamily: fonts.alanSans.regular,
  },
});
