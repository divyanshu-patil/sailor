import { Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, WidgetEnvironment } from "expo-widgets";

interface StreakProps {
  streakCount: number;
  /** From the picker in Settings, not a widget long-press configuration —
   *  it's an app setting, so it arrives as an ordinary prop. */
  backgroundColor: string;
  /** Resolved in the app, since the widget can't hold a lookup table. */
  label: string;
}

function Streak(
  { streakCount, backgroundColor, label }: StreakProps,
  environment: WidgetEnvironment,
) {
  "widget";

  const isDark = environment.colorScheme === "dark";
  const textColor = isDark ? "#F5F3EE" : "#1B1B1B";

  return (
    <VStack
      spacing={2}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        padding({ all: 12 }),
        // Alpha first: @expo/ui reads 8-digit hex as #AARRGGBB.
        background(isDark ? `#CC${backgroundColor.slice(1)}` : backgroundColor),
        containerBackground(backgroundColor, "widget"),
        widgetURL("sailor://daily-practice"),
      ]}
    >
      <Text
        modifiers={[
          font({ size: 44, weight: "bold", design: "rounded" }),
          foregroundStyle(textColor),
        ]}
      >
        {String(streakCount)}
      </Text>
      <Text
        modifiers={[
          font({ size: 12, weight: "medium" }),
          foregroundStyle(isDark ? "#B0F5F3EE" : "#A01B1B1B"),
        ]}
      >
        {label}
      </Text>
    </VStack>
  );
}

export const StreakWidget = createWidget<StreakProps>("StreakWidget", Streak);
