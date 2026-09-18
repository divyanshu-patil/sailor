import { HStack, Image, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  background,
  clipped,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  italic,
  lineLimit,
  minimumScaleFactor,
  offset,
  opacity,
  padding,
  resizable,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, WidgetEnvironment } from "expo-widgets";

export interface StreakProps {
  /** Matches the practice tile's, so two Sailor widgets side by side read as
   *  one set rather than two apps. */
  variation?: "warm" | "cool";
  streakCount?: number;
  label?: string;
  note?: string;
  /** From the picker in Settings, not a widget long-press configuration — it's
   *  an app setting, so it arrives as an ordinary prop. It tints the sticker
   *  rather than the tile: the tile is a baked plate now, and a picker that
   *  visibly did nothing would be worse than no picker. */
  accentColor?: string;
  /** `file://` paths inside the App Group — see lib/widget-assets.ts. */
  plateUri?: string;
  mascotUri?: string;
}

/**
 * The streak, as one big number.
 *
 * Same construction as the practice tile: a baked background plate edge to
 * edge, the character cropped by the tile's own corner, the handwritten note
 * and the heart placed by offset so they can sit wherever the art wants — only
 * the number and its label are inset. See the long note in
 * TodaysPracticeWidget for why nothing here may be larger than the tile, why
 * every prop is defaulted, and what may be referenced from this function body.
 *
 * The seven-dot week this used to draw is gone — at this size it competed with
 * the number for the one glance a widget gets, and the number is the thing
 * somebody puts a streak widget on their home screen for.
 *
 */
function Streak(props: StreakProps, environment: WidgetEnvironment) {
  "widget";

  const isDark = environment.colorScheme === "dark";

  const PALETTES = {
    warm: { base: "#FFFCF7", ink: "#262533", inkSoft: "#7E7A88", heart: "#FF8FB2", showFlame: true },
    cool: { base: "#FBFCFF", ink: "#262533", inkSoft: "#7E7A88", heart: "#A99BF0", showFlame: false },

  };

  const palette = props.variation === "cool" ? PALETTES.cool : PALETTES.warm;

  // Alpha first: @expo/ui reads 8-digit hex as #AARRGGBB.
  function dim(color: string, alpha: string) {
    return isDark ? `#${alpha}${color.slice(1)}` : color;
  }

  const ink = isDark ? "#F7F5F0" : palette.ink;
  const inkSoft = isDark ? "#B5F7F5F0" : palette.inkSoft;

  const raw = props.streakCount;
  // A real number, including 0, is data. Anything else means the app hasn't
  // pushed yet — and showing "0" then would be a lie to someone on a 12-day
  // streak, so the no-data state gets its own glyph.
  const hasData = typeof raw === "number" && isFinite(raw);
  const count = hasData ? String(Math.max(0, Math.trunc(raw as number))) : "—";

  const rawLabel = props.label;
  const label = hasData
    ? typeof rawLabel === "string" && rawLabel.length > 0
      ? rawLabel
      : "day streak"
    : "Open Sailor";

  const rawNote = props.note;
  const note = typeof rawNote === "string" ? rawNote : "";

  const rawAccent = props.accentColor;
  const heart =
    typeof rawAccent === "string" && rawAccent.length === 7 ? rawAccent : palette.heart;

  const rawPlate = props.plateUri;
  const plateUri = typeof rawPlate === "string" && rawPlate.length > 0 ? rawPlate : "";

  const rawMascot = props.mascotUri;
  const mascotUri =
    typeof rawMascot === "string" && rawMascot.length > 0 ? rawMascot : "";

  return (
    <ZStack
      alignment="topLeading"
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
        background(dim(palette.base, "F2")),
        containerBackground(dim(palette.base, "F2"), "widget"),
        clipped(),
        widgetURL("sailor://daily-practice"),
      ]}
    >
      {plateUri ? (
        <Image
          uiImage={plateUri}
          modifiers={[
            resizable(),
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            opacity(isDark ? 0.42 : 1),
          ]}
        />
      ) : null}

      {mascotUri ? (
        <VStack
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "bottom" }),
          ]}
        >
          <Image
            uiImage={mascotUri}
            modifiers={[
              resizable(),
              frame({ width: 152, height: 107 }),
              // The eyes sit ~64% down the art; the bleed stops above them.
              offset({ x: 6, y: 14 }),
            ]}
          />
        </VStack>
      ) : null}

      {/* Unpadded on purpose: the aside is part of the art, not the copy, and
          the reference tucks it right into the corner. */}
      {note ? (
        <VStack
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topTrailing" }),
          ]}
        >
          <Text
            modifiers={[
              // Serif italic is as close to a hand as the system fonts get
              // without embedding one in the extension.
              font({ size: 12, weight: "medium", design: "serif" }),
              italic(),
              foregroundStyle(inkSoft),
              frame({ width: 68, alignment: "trailing" }),
              lineLimit(3),
              minimumScaleFactor(0.8),
              offset({ x: -11, y: 15 }),
            ]}
          >
            {note}
          </Text>
        </VStack>
      ) : null}

      <VStack
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "trailing" }),
        ]}
      >
        <Image
          systemName="heart.fill"
          size={18}
          color={dim(heart, "CC")}
          modifiers={[offset({ x: -16, y: -4 })]}
        />
      </VStack>

      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
          padding({ all: 15 }),
        ]}
      >
        <HStack spacing={5}>
          {palette.showFlame && hasData ? (
            <Image systemName="flame.fill" size={28} color="#FF7A3D" />
          ) : (
            <Image systemName="star.fill" size={26} color="#FFC933" />
          )}
          <Text
            modifiers={[
              // Rounded numerals, tight against the label under them.
              font({ size: 46, weight: "bold", design: "rounded" }),
              foregroundStyle(ink),
              lineLimit(1),
              minimumScaleFactor(0.6),
            ]}
          >
            {count}
          </Text>
          <Spacer />
        </HStack>

        <Text
          modifiers={[
            font({ size: 17, weight: "bold", design: "rounded" }),
            foregroundStyle(ink),
            lineLimit(1),
            minimumScaleFactor(0.8),
          ]}
        >
          {label}
        </Text>

        <Spacer />
      </VStack>
    </ZStack>
  );
}

export const StreakWidget = createWidget<StreakProps>("StreakWidget", Streak);
