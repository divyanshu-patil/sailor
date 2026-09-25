import { HStack, Image, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  background,
  clipped,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  offset,
  padding,
  resizable,
  shadow,
  shapes,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, WidgetEnvironment } from "expo-widgets";

export interface StreakWeekProps {
  streakCount?: number;
  /** The two lines beside the number — "days" / "in a row!". The app words
   *  them per state; the widget only lays them out. */
  line1?: string;
  line2?: string;
  /** The pill, top right. One short line. */
  note?: string;
  status?: "alive" | "atRisk" | "broken" | "expired";
  /** Monday to Sunday, one letter per day — see lib/streak-days `weekPattern`. */
  week?: string;
  deepLink?: string;
  /** `file://` paths inside the App Group — see lib/widget-assets.ts. */
  flameUri?: string;
  mascotUri?: string;
  pawsUri?: string;
}

/**
 * The streak with its week, systemMedium only.
 *
 * Two white cards on a plain warm tile — no patterned plate behind them: the
 * count top left, the week along the bottom, and the character peeking up
 * from behind the week card. The
 * character is two PNGs on one canvas drawn at the same frame and offset — the
 * body under the card, the paws over it — which is how it grips the edge
 * without a widget having any way to mask one image with another.
 *
 * Every rule from TodaysPracticeWidget applies: the body is serialised on its
 * own, so nothing from module scope; every prop is defaulted because WidgetKit
 * renders with none; nothing larger than the tile. scripts/check-widgets.mjs
 * enforces all three.
 */
function StreakWeek(props: StreakWeekProps, environment: WidgetEnvironment) {
  "widget";

  const isDark = environment.colorScheme === "dark";

  // Alpha first in 8-digit hex: @expo/ui reads #AARRGGBB.
  const c = isDark
    ? {
        tile: "#141319",
        card: "#211F27",
        ink: "#F4F2EE",
        inkSoft: "#A29EAB",
        done: "#EBC867",
        check: "#1E1C24",
        today: "#3A3322",
        todayDot: "#EBC867",
        empty: "#2C2A33",
        missed: "#2C2A33",
        missedMark: "#5E5A66",
        pill: "#3B3322",
        pillInk: "#F1D38A",
        shadow: "#40000000",
      }
    : {
        tile: "#F4EFE8",
        card: "#FFFDFA",
        ink: "#1E1C24",
        inkSoft: "#8A8590",
        done: "#F7DC8F",
        check: "#1E1C24",
        today: "#FCF1D2",
        todayDot: "#EBBF45",
        empty: "#EFF0F6",
        missed: "#F1EEF0",
        missedMark: "#C9C3CB",
        pill: "#F8E4A9",
        pillInk: "#85661F",
        shadow: "#0F3A2A1A",
      };

  const raw = props.streakCount;
  // No number yet means the app has not pushed — "0" would be a lie to someone
  // mid-streak, so the empty state gets a dash, as on the small tile.
  const hasData = typeof raw === "number" && isFinite(raw);
  const count = hasData ? String(Math.max(0, Math.trunc(raw as number))) : "–";
  const countSize = count.length > 3 ? 36 : count.length > 2 ? 44 : 52;

  const rawLine1 = props.line1;
  const line1 =
    typeof rawLine1 === "string" && rawLine1.length > 0
      ? rawLine1
      : hasData
        ? "days"
        : "Open";
  const rawLine2 = props.line2;
  const line2 =
    typeof rawLine2 === "string" && rawLine2.length > 0
      ? rawLine2
      : hasData
        ? "in a row!"
        : "Sailors";

  const rawNote = props.note;
  const note = typeof rawNote === "string" ? rawNote : "";

  const rawStatus = props.status;
  const broken = rawStatus === "broken" || rawStatus === "expired";
  const pillBg = broken ? (isDark ? "#3A2429" : "#F9DCDF") : c.pill;
  const pillInk = broken ? (isDark ? "#F2A9B3" : "#A2404F") : c.pillInk;

  const rawWeek = props.week;
  const week =
    typeof rawWeek === "string" && /^[DMTF]{7}$/.test(rawWeek)
      ? rawWeek
      : "FFFFFFF";

  const rawLink = props.deepLink;
  const link =
    typeof rawLink === "string" && rawLink.length > 0
      ? rawLink
      : "sailors://daily-practice";

  const rawFlame = props.flameUri;
  const flameUri =
    typeof rawFlame === "string" && rawFlame.length > 0 ? rawFlame : "";
  const rawMascot = props.mascotUri;
  const mascotUri =
    typeof rawMascot === "string" && rawMascot.length > 0 ? rawMascot : "";
  const rawPaws = props.pawsUri;
  const pawsUri =
    typeof rawPaws === "string" && rawPaws.length > 0 ? rawPaws : "";

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Card height is fixed so the character can be placed against its top edge
  // by offset; everything above it flexes with the tile.
  const inset = 8;
  const weekCardHeight = 60;
  // The character's canvas is 400 x 300; the paws' centres sit at y ~236.
  const mascotW = 120;
  const mascotH = 90;
  // Lifts the image so the paws' centres sit right on the week card's top
  // edge — gripping it, clear of the day circles below:
  // (card top from the tile's bottom) - (paw centre from the image's).
  const mascotLift = -(inset + weekCardHeight + 1 - mascotH * (1 - 0.79));

  const cardShadow = shadow({ radius: 5, x: 0, y: 1.5, color: c.shadow });

  function character(uri: string) {
    return (
      <VStack
        modifiers={[
          frame({
            maxWidth: Infinity,
            maxHeight: Infinity,
            alignment: "bottomTrailing",
          }),
        ]}
      >
        <Image
          uiImage={uri}
          modifiers={[
            resizable(),
            frame({ width: mascotW, height: mascotH }),
            offset({ x: -12, y: mascotLift }),
          ]}
        />
      </VStack>
    );
  }

  function day(i: number) {
    const state = week[i];
    const isToday = state === "T";
    return (
      <VStack
        key={labels[i]}
        spacing={4}
        modifiers={[frame({ maxWidth: Infinity })]}
      >
        <ZStack
          modifiers={[
            frame({ width: 26, height: 26 }),
            background(
              state === "D"
                ? c.done
                : isToday
                  ? c.today
                  : state === "M"
                    ? c.missed
                    : c.empty,
              shapes.circle(),
            ),
          ]}
        >
          {state === "D" ? (
            <Image
              systemName="checkmark"
              size={11}
              color={c.check}
              modifiers={[font({ size: 11, weight: "black" })]}
            />
          ) : isToday ? (
            <Image systemName="circle.fill" size={7} color={c.todayDot} />
          ) : state === "M" ? (
            <Image
              systemName="minus"
              size={10}
              color={c.missedMark}
              modifiers={[font({ size: 10, weight: "bold" })]}
            />
          ) : null}
        </ZStack>
        <Text
          modifiers={[
            font({
              size: 10.5,
              weight: isToday ? "bold" : "medium",
              design: "rounded",
            }),
            foregroundStyle(isToday ? c.ink : c.inkSoft),
            lineLimit(1),
          ]}
        >
          {labels[i]}
        </Text>
      </VStack>
    );
  }

  return (
    <ZStack
      alignment="topLeading"
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
        background(c.tile),
        containerBackground(c.tile, "widget"),
        clipped(),
        widgetURL(link),
      ]}
    >
      {mascotUri ? character(mascotUri) : null}

      <VStack
        spacing={6}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          padding({ all: inset }),
        ]}
      >
        <HStack alignment="top" spacing={0}>
          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[
              padding({ leading: 12, trailing: 16, top: 9, bottom: 2 }),
              frame({ maxHeight: Infinity, alignment: "topLeading" }),
              background(c.card, shapes.roundedRectangle({ cornerRadius: 16 })),
              cardShadow,
            ]}
          >
            <HStack spacing={5}>
              {flameUri ? (
                <Image
                  uiImage={flameUri}
                  modifiers={[resizable(), frame({ width: 17, height: 17 })]}
                />
              ) : (
                <Image systemName="flame.fill" size={14} color="#EC8A64" />
              )}
              <Text
                modifiers={[
                  font({ size: 13, weight: "semibold", design: "rounded" }),
                  foregroundStyle(c.ink),
                  lineLimit(1),
                ]}
              >
                Your Streak
              </Text>
            </HStack>
            <Spacer />
            <HStack spacing={7}>
              <Text
                modifiers={[
                  font({ size: countSize, weight: "heavy", design: "rounded" }),
                  foregroundStyle(c.ink),
                  lineLimit(1),
                  minimumScaleFactor(0.6),
                ]}
              >
                {count}
              </Text>
              <VStack alignment="leading" spacing={0}>
                <Text
                  modifiers={[
                    font({ size: 13.5, weight: "semibold", design: "rounded" }),
                    foregroundStyle(c.ink),
                    lineLimit(1),
                  ]}
                >
                  {line1}
                </Text>
                <Text
                  modifiers={[
                    font({ size: 13.5, weight: "semibold", design: "rounded" }),
                    foregroundStyle(c.ink),
                    lineLimit(1),
                    minimumScaleFactor(0.8),
                  ]}
                >
                  {line2}
                </Text>
              </VStack>
            </HStack>
          </VStack>
          <Spacer />
          {note ? (
            <Text
              modifiers={[
                font({ size: 12, weight: "semibold", design: "rounded" }),
                foregroundStyle(pillInk),
                lineLimit(1),
                minimumScaleFactor(0.8),
                padding({ horizontal: 11, vertical: 5 }),
                background(pillBg, shapes.capsule()),

              ]}
            >
              {note}
            </Text>
          ) : null}
        </HStack>

        <HStack
          spacing={0}
          modifiers={[
            // Weighted down: the paws hang over the top few points.
            padding({ horizontal: 6, top: 6 }),
            frame({ maxWidth: Infinity, height: weekCardHeight }),
            background(c.card, shapes.roundedRectangle({ cornerRadius: 16 })),
            cardShadow,
          ]}
        >
          {day(0)}
          {day(1)}
          {day(2)}
          {day(3)}
          {day(4)}
          {day(5)}
          {day(6)}
        </HStack>
      </VStack>

      {pawsUri ? character(pawsUri) : null}
    </ZStack>
  );
}

export const StreakWeekWidget = createWidget<StreakWeekProps>(
  "StreakWeekWidget",
  StreakWeek,
);
