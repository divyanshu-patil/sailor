import React, { forwardRef, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import FontAwesome6 from "@react-native-vector-icons/fontawesome6";

export interface FloatingLabelInputProps extends Omit<
  TextInputProps,
  "placeholder" | "onFocus" | "onBlur"
> {
  /** Text shown as the floating label (acts like your placeholder) */
  label: string;
  /** Current value of the input — component is controlled */
  value: string;
  /** Called whenever the text changes */
  onChangeText: (text: string) => void;
  /** Optional error message. When set, border/label turn red and the message shows below */
  errorMessage?: string;
  /** Adds a Show/Hide toggle and masks the input like a password field */
  isPassword?: boolean;
  /** Style for the outer wrapper (wraps input box + error text) */
  containerStyle?: StyleProp<ViewStyle>;
  /** Style for the bordered box that holds the input */
  inputContainerStyle?: StyleProp<ViewStyle>;
  /** Style for the TextInput text itself */
  inputStyle?: StyleProp<TextStyle>;
  /** Style for the floating label text */
  labelStyle?: StyleProp<TextStyle>;
  backgroundColor?: string;
  borderColor?: string;
  focusedBorderColor?: string;
  labelColor?: string;
  focusedLabelColor?: string;
  errorColor?: string;
  onFocus?: TextInputProps["onFocus"];
  onBlur?: TextInputProps["onBlur"];
}

/**
 * A TextInput with a floating label that starts as a placeholder inside the
 * field and animates up to sit "on" the border line when the field is
 * focused or has a value — the classic Material-style outlined input.
 *
 * The illusion of the border having a notch for the label is faked by
 * giving the label the same backgroundColor as the input box, so it visually
 * masks the border segment behind it.
 */
const FloatingLabelInput = forwardRef<TextInput, FloatingLabelInputProps>(
  (
    {
      label,
      value,
      onChangeText,
      errorMessage,
      isPassword = false,
      containerStyle,
      inputContainerStyle,
      inputStyle,
      labelStyle,
      backgroundColor = "#FFFFFF",
      borderColor = "#B0B0B0",
      focusedBorderColor = "#6C63FF",
      labelColor = "#8A8A8A",
      focusedLabelColor = "#6C63FF",
      errorColor = "#E63946",
      onFocus,
      onBlur,
      editable = true,
      ...rest
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isSecure, setIsSecure] = useState(isPassword);

    // 1 = label floating up top, 0 = label resting inside like a placeholder
    const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

    const hasError = Boolean(errorMessage);

    const animateLabel = (toValue: 0 | 1) => {
      Animated.timing(animatedValue, {
        toValue,
        duration: 150,
        useNativeDriver: false, // animating fontSize/color, can't use native driver
      }).start();
    };

    const handleFocus: TextInputProps["onFocus"] = (e) => {
      setIsFocused(true);
      animateLabel(1);
      onFocus?.(e);
    };

    const handleBlur: TextInputProps["onBlur"] = (e) => {
      setIsFocused(false);
      if (!value) animateLabel(0); // only drop back down if field is empty
      onBlur?.(e);
    };

    const labelTranslateY = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -27], // tweak to taste based on inputContainer height
    });

    const labelFontSize = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    });

    const activeBorderColor = hasError
      ? errorColor
      : isFocused
        ? focusedBorderColor
        : borderColor;

    const activeLabelColor = hasError
      ? errorColor
      : isFocused
        ? focusedLabelColor
        : labelColor;

    return (
      <View style={[styles.wrapper, containerStyle]}>
        <View
          style={[
            styles.inputContainer,
            { borderColor: activeBorderColor, backgroundColor },
            inputContainerStyle,
          ]}
        >
          <Animated.Text
            pointerEvents="none"
            numberOfLines={1}
            style={[
              styles.label,
              {
                backgroundColor,
                color: activeLabelColor,
                fontSize: labelFontSize,
                transform: [{ translateY: labelTranslateY }],
              },
              labelStyle,
            ]}
          >
            {label}
          </Animated.Text>

          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={editable}
            secureTextEntry={isSecure}
            style={[
              styles.input,
              !editable && styles.inputDisabled,
              inputStyle,
            ]}
            {...rest}
          />

          {isPassword && (
            <Pressable
              onPress={() => setIsSecure((prev) => !prev)}
              hitSlop={8}
              style={styles.toggle}
            >
              {isSecure ? (
                <FontAwesome6 name="eye" size={20} color="#8E8E93" />
              ) : (
                <FontAwesome6 name="eye-slash" size={20} color="#8E8E93" />
              )}
            </Pressable>
          )}
        </View>

        {hasError ? (
          <Text style={[styles.errorText, { color: errorColor }]}>
            {errorMessage}
          </Text>
        ) : null}
      </View>
    );
  },
);

FloatingLabelInput.displayName = "FloatingLabelInput";

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginVertical: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  label: {
    position: "absolute",
    left: 10,
    top: 18,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1A1A1A",
    paddingVertical: 0,
    paddingTop: Platform.select({ ios: 0, android: 2, default: 0 }),
  },
  inputDisabled: {
    color: "#A0A0A0",
  },
  toggle: {
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6C63FF",
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default FloatingLabelInput;
