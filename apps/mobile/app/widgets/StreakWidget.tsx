import { HStack, Image, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  aspectRatio,
  background,
  clipped,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  lineSpacing,
  multilineTextAlignment,
  minimumScaleFactor,
  offset,
  opacity,
  padding,
  resizable,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, WidgetEnvironment } from "expo-widgets";

export interface StreakProps {
  streakCount?: number;
  label?: string;
  note?: string;
  /** From the picker in Settings, not a widget long-press configuration — it's
   *  an app setting, so it arrives as an ordinary prop. It tints the sticker
   *  rather than the tile: the tile is a baked plate now, and a picker that
   *  visibly did nothing would be worse than no picker. */
  accentColor?: string;
  /**
   * Which state the streak is in. Chooses the icon beside the count and the
   * face at the bottom; the app resolves both to `file://` paths because a
   * widget cannot read the app's bundle.
   */
  status?: "alive" | "atRisk" | "broken" | "expired";
  /** Where a tap goes. The app decides — a broken streak that can still be
   *  restored opens the restore screen, everything else opens practice. */
  deepLink?: string;
  /** `file://` paths inside the App Group — see lib/widget-assets.ts. */
  iconUri?: string;
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

  const palette = {
    base: "#FBFCFF",
    baseDark: "#15161E",
    ink: "#262533",
    inkSoft: "#7E7A88",
    heart: "#A99BF0",
  };

  // Alpha first: @expo/ui reads 8-digit hex as #AARRGGBB.
  function dim(color: string, alpha: string) {
    return isDark ? `#${alpha}${color.slice(1)}` : color;
  }

  // The tile's own fill. In dark mode this is a real dark colour rather than a
  // dimmed light one: alpha-blending the cream base left the tile near-white,
  // and the light ink below then sat on a light ground and vanished.
  const base = isDark ? palette.baseDark : palette.base;
  const ink = isDark ? "#F4F2EE" : palette.ink;
  const inkSoft = isDark ? "#BFBBC7" : palette.inkSoft;

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
      : "Day Streak"
    : "Open Sailor";

  const rawNote = props.note;
  const note = typeof rawNote === "string" ? rawNote : "";

  const rawAccent = props.accentColor;
  const heart =
    typeof rawAccent === "string" && rawAccent.length === 7
      ? rawAccent
      : palette.heart;

  const rawPlate = props.plateUri;
  const plateUri =
    typeof rawPlate === "string" && rawPlate.length > 0 ? rawPlate : "";

  const rawIcon = props.iconUri;
  const iconUri = typeof rawIcon === "string" && rawIcon.length > 0 ? rawIcon : "";

  const rawStatus = props.status;
  const status =
    rawStatus === "atRisk" ||
    rawStatus === "broken" ||
    rawStatus === "expired"
      ? rawStatus
      : "alive";

  const rawLink = props.deepLink;
  const link =
    typeof rawLink === "string" && rawLink.length > 0
      ? rawLink
      : "sailor://daily-practice";

  // The fallback symbol matches whichever state the art failed to arrive for,
  // so a missing PNG degrades to the right idea rather than always to a flame.
  const fallbackSymbol =
    status === "broken" || status === "expired"
      ? "heart.slash.fill"
      : status === "atRisk"
        ? "hourglass"
        : "flame.fill";
  const fallbackTint =
    status === "broken" || status === "expired"
      ? "#E06070"
      : status === "atRisk"
        ? "#C8A44C"
        : "#FF7A3D";

  // Big numbers need more room than the label under them has. Stepping the size
  // down by digit count keeps "12" large and "1204" on one line, without
  // relying on minimumScaleFactor to shrink it after the fact.
  const digits = count.length;
  // Tuned against the tile, not the mock: a small widget is 158pt wide and the
  // aside needs the right third of it, so the count block gets the left ~55%.
  // Stepping by digit count keeps "12" large and "1204" on one line without
  // leaving it to minimumScaleFactor to rescue after the fact.
  const countSize = digits > 3 ? 28 : digits > 2 ? 34 : 40;

  const rawMascot = props.mascotUri;
  const mascotUri =
    typeof rawMascot === "string" && rawMascot.length > 0 ? rawMascot : "";

  return (
    <ZStack
      alignment="topLeading"
      modifiers={[
        frame({
          maxWidth: Infinity,
          maxHeight: Infinity,
          alignment: "topLeading",
        }),
        background(base),
        containerBackground(base, "widget"),
        clipped(),
        widgetURL(link),
      ]}
    >
      {plateUri ? (
        <Image
          uiImage={plateUri}
          modifiers={[
            resizable(),
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            // A light plate over a dark base. At 0.3 the composite came out a
            // mid grey that read as neither light nor dark; this keeps the tile
            // properly dark while the pastel shapes still show as faint tints.
            opacity(isDark ? 0.22 : 1),
          ]}
        />
      ) : null}

      {mascotUri ? (
        <VStack
          modifiers={[
            frame({
              maxWidth: Infinity,
              maxHeight: Infinity,
              alignment: "bottom",
            }),
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
            frame({
              maxWidth: Infinity,
              maxHeight: Infinity,
              alignment: "topTrailing",
            }),
          ]}
        >
          <Text
            modifiers={[
              // Kalam is embedded in the extension by
              // plugins/with-widget-fonts — the app's own fonts aren't visible
              // to a widget.
              font({ family: "Kalam-Regular", size: 12 }),
              foregroundStyle(inkSoft),
              // Negative leading: Kalam's default line box is generous and the
              // aside read as three separate remarks rather than one. This is
              // what closes the gap in the reference.
              lineSpacing(-3),
              multilineTextAlignment("trailing"),
              // 76, not 92: the aside and the label under the count share one
              // 158pt row, and at 92 the note's left edge sat under the end of
              // "day streak".
              frame({ width: 68, alignment: "trailing" }),
              // Two lines, so the aside never reaches down to the label on its
              // left. The copy in widget-sync is written to fit in two.
              lineLimit(2),
              minimumScaleFactor(0.7),
              offset({ x: -7, y: 11 }),
            ]}
          >
            {note}
          </Text>
        </VStack>
      ) : null}

      <VStack
        modifiers={[
          frame({
            maxWidth: Infinity,
            maxHeight: Infinity,
            alignment: "trailing",
          }),
        ]}
      >
        <Image
          systemName="heart.fill"
          size={18}
          color={dim(heart, "CC")}
          // Below the two-line aside, not across it. The note ends around 62pt
          // down a 158pt tile; the vertical centre puts this clear of it.
          modifiers={[offset({ x: -14, y: -4 })]}
        />
      </VStack>

      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          frame({
            maxWidth: Infinity,
            maxHeight: Infinity,
            alignment: "topLeading",
          }),
          padding({ all: 15 }),
        ]}
      >
        <HStack
          spacing={4}
          modifiers={[frame({ maxWidth: 86, alignment: "leading" })]}
        >
          {/* A PNG, not SF Symbols' `flame.fill`: the symbol is one flat tint,
              and the lighter core inside the warmer outer is most of what makes
              this read as fire — and because the star it replaced said nothing
              about a streak. */}
          {iconUri ? (
            <Image
              uiImage={iconUri}
              modifiers={[
                resizable(),
                aspectRatio({ contentMode: "fit" }),
                frame({ width: 32, height: 32 }),
              ]}
            />
          ) : (
            <Image systemName={fallbackSymbol} size={28} color={fallbackTint} />
          )}
          <Text
            modifiers={[
              // Rounded numerals, tight against the label under them.
              font({ size: countSize, weight: "bold", design: "rounded" }),
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
            font({
              size: 16,
              weight: "bold",
              design: "rounded",
            }),
            foregroundStyle(ink),
            // Bounded so it cannot grow under the aside on its right. The
            // scale factor then does the rest on the widest labels.
            frame({ maxWidth: 88, alignment: "leading" }),
            lineLimit(1),
            minimumScaleFactor(0.7),
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
