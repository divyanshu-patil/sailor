import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { profileFonts, PROFILE } from "@/screens/profile/theme";

interface OnboardingInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
}

/** The rounded nickname field: icon, large touch target, warm light surface. */
export default function OnboardingInput({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  editable = true,
  returnKeyType,
  onSubmitEditing,
  accessibilityLabel,
}: OnboardingInputProps) {
  return (
    <View style={styles.container}>
      <Ionicons
        name="person-add"
        size={20}
        color={PROFILE.ink}
        style={styles.icon}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={PROFILE.muted}
        autoFocus={autoFocus}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={40}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PROFILE.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PROFILE.track,
    paddingHorizontal: 18,
    minHeight: 60,
  },
  icon: { marginRight: 12 },
  input: {
    flex: 1,
    fontFamily: profileFonts.medium,
    fontSize: 17,
    color: PROFILE.ink,
    paddingVertical: 16,
  },
});
