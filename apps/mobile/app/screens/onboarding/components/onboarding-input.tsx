import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

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

/** The dashed outline and the "Add Name" placeholder share this pastel green. */
const FIELD_GREEN = "#A8DDB5";

/**
 * The nickname field: a dashed pill with a pastel-green placeholder that grows
 * with the name as it is typed.
 */
export default function OnboardingInput({
  value,
  onChangeText,
  placeholder = "Add Name",
  autoFocus,
  editable = true,
  returnKeyType,
  onSubmitEditing,
  accessibilityLabel,
}: OnboardingInputProps) {
  return (
    <View style={styles.pill}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={FIELD_GREEN}
        autoFocus={autoFocus}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={40}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        // Hug the text so the pill stays compact and grows as the name is typed.
        style={[
          styles.input,
          { width: Math.max(88, Math.min(220, value.length * 11 + 30)) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: FIELD_GREEN,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  input: {
    fontFamily: profileFonts.semibold,
    fontSize: 17,
    color: PROFILE.ink,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});
