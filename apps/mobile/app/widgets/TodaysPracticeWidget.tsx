import { Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, WidgetEnvironment } from "expo-widgets";

interface TodaysPracticeProps {
  /** Already-humanised ("Openings"), not the raw ContentType — the widget can't
   *  reach a lookup table at module scope, so the app resolves it. */
  typeLabel: string;
  oneLiner: string;
  gradientColors: [string, string];
}

/**
 * Today's snippet, as a home-screen tile.
 *
 * Everything it shows arrives as props from the app (see lib/widget-sync.ts).
 * The widget has no network, no auth and no store of its own, which is what
 * makes it correct offline: it renders the last thing it was handed, and that is
 * by construction the same unit the app is showing.
 */
function TodaysPractice(
  { typeLabel, oneLiner, gradientColors }: TodaysPracticeProps,
  environment: WidgetEnvironment,
) {
  "widget";

  const isDark = environment.colorScheme === "dark";
  // The pastels are picked to sit under dark text; on a dark home screen the
  // same fill is dimmed rather than swapped, so the widget still reads as the
  // same tile in both appearances.
  const textColor = isDark ? "#F5F3EE" : "#1B1B1B";
  const labelColor = isDark ? "#B0F5F3EE" : "#A01B1B1B";

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
        padding({ all: 14 }),
        background({
          type: "linearGradient",
          // Dimmed for dark mode. The alpha goes in FRONT — @expo/ui reads an
          // 8-digit hex as #AARRGGBB, so appending it swaps the channels and
          // paints a completely different colour.
          colors: isDark
            ? [`#CC${gradientColors[0].slice(1)}`, `#CC${gradientColors[1].slice(1)}`]
            : gradientColors,
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 1, y: 1 },
        }),
        // iOS 17+ gives the widget itself a background; without this the tile
        // is the system default and the gradient stops at the content inset.
        containerBackground(gradientColors[0], "widget"),
        // One tap target for the whole widget, which is what WidgetKit supports
        // for systemSmall/systemMedium anyway — a Link wrapper would only matter
        // if different regions needed different destinations.
        widgetURL("sailor://daily-practice"),
      ]}
    >
      <Text
        modifiers={[
          font({ size: 11, weight: "semibold" }),
          foregroundStyle(labelColor),
        ]}
      >
        {typeLabel.toUpperCase()}
      </Text>
      <Text
        modifiers={[
          font({ size: 15, weight: "medium", design: "serif" }),
          foregroundStyle(textColor),
          lineLimit(environment.widgetFamily === "systemSmall" ? 4 : 3),
        ]}
      >
        {oneLiner}
      </Text>
      <Spacer />
    </VStack>
  );
}

export const TodaysPracticeWidget = createWidget<TodaysPracticeProps>(
  "TodaysPracticeWidget",
  TodaysPractice,
);
