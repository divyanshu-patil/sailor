import { Button, Host, HStack, Text, VStack } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  buttonBorderShape,
  buttonStyle,
  contentTransition,
  controlSize,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  lineLimit,
  lineSpacing,
  multilineTextAlignment,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  useWindowDimensions,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";

const FONT_SIZE = 16;
const LINE_HEIGHT = 22;
const MAX_LINES = 4;
const HORIZONTAL_PADDING = 24;
const ACTIONS_BASE_BOTTOM_SPACING = 24;

const HEADLINES = [
  { line1: "Your ideas", line2: "Your stage." },
  { line1: "Find your voice", line2: "Own the room." },
  { line1: "Prepare better", line2: "Perform better." },
] as const;

export default function Base() {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = windowWidth - HORIZONTAL_PADDING * 2;
  const router = useRouter();
  const [headlineIndex1, setHeadlineIndex1] = useState(0);
  const [headlineIndex2, setHeadlineIndex2] = useState(0);
  const colors = useColors();

  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIndex1((prev) => {
        const next = (prev + 1) % HEADLINES.length;

        setTimeout(() => {
          setHeadlineIndex2(next);
        }, 200);

        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleLogin = () => {
    router.push("/(unauthenticated)/login");
  };

  const handleSignUp = () => {
    router.push("/(unauthenticated)/(signup)/signup");
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image
          source={require("@/assets/images/temp-mascot-1.png")}
          resizeMode="cover"
          style={styles.image}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      <View style={styles.content}>
        <Host
          matchContents={{ vertical: true }}
          modifiers={[
            animation(Animation.default, headlineIndex1),
            animation(Animation.default, headlineIndex2),
          ]}
          style={{ width: "100%" }}
        >
          <VStack spacing={12}>
            <VStack spacing={6}>
              <Text
                modifiers={[
                  font({
                    family: fonts.alanSans.bold,
                    design: "rounded",
                    size: 30,
                  }),
                  contentTransition("numericText", { countsDown: true }),
                  animation(Animation.default, headlineIndex1),
                  multilineTextAlignment("center"),
                ]}
              >
                {HEADLINES[headlineIndex1].line1.toUpperCase()}
              </Text>

              <Text
                modifiers={[
                  font({
                    family: fonts.alanSans.semiBold,
                    design: "rounded",
                    size: 25,
                  }),
                  contentTransition("numericText", { countsDown: true }),
                  animation(Animation.default, headlineIndex2),
                  multilineTextAlignment("center"),
                ]}
              >
                {HEADLINES[headlineIndex2].line2}
              </Text>
            </VStack>

            <Text
              modifiers={[
                font({
                  family: fonts.alanSans.medium,
                  size: FONT_SIZE,
                  design: "rounded",
                }),
                lineSpacing(LINE_HEIGHT - FONT_SIZE),
                frame({
                  width: contentWidth,
                  height: LINE_HEIGHT * MAX_LINES,
                  alignment: "top",
                }),
                foregroundStyle("#44444ec5"),
                lineLimit(MAX_LINES),
                multilineTextAlignment("center"),
              ]}
            >
              Create stunning presentations, craft compelling speeches, and
              practice with confidence all in one place.
            </Text>
            <VStack spacing={12}>
              <Button
                onPress={handleSignUp}
                modifiers={[
                  buttonStyle("glassProminent"),
                  controlSize("extraLarge"),
                  buttonBorderShape("capsule"),
                  tint(colors.colors.rust),
                ]}
              >
                <Text
                  modifiers={[
                    frame({
                      maxWidth: Infinity,
                      alignment: "center",
                    }),
                    font({
                      family: fonts.alanSans.semiBold,
                      design: "rounded",
                    }),
                  ]}
                >
                  create an account
                </Text>
              </Button>
              <Button
                onPress={handleLogin}
                modifiers={[
                  buttonStyle("bordered"),
                  controlSize("extraLarge"),
                  buttonBorderShape("capsule"),
                  tint(colors.colors.rust),
                ]}
              >
                <Text
                  modifiers={[
                    frame({
                      maxWidth: Infinity,
                      alignment: "center",
                    }),
                    font({
                      family: fonts.alanSans.semiBold,
                      design: "rounded",
                    }),
                  ]}
                >
                  Log in
                </Text>
              </Button>
            </VStack>
          </VStack>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFEFE",
  },

  hero: {
    flex: 1,
    overflow: "visible",
  },

  image: {
    width: "100%",
    height: "100%",
    alignSelf: "center",
  },

  content: {
    flex: 0.55,
    paddingHorizontal: HORIZONTAL_PADDING,
    justifyContent: "space-between",
  },

  actions: {
    gap: 12,
  },

  loginButton: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#FF6347",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },

  signupButton: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FF6347",
    justifyContent: "center",
    alignItems: "center",
  },

  buttonPressed: {
    opacity: 0.7,
  },

  loginText: {
    color: "#FF6347",
    fontSize: 16,
    fontWeight: "700",
  },

  signupText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
