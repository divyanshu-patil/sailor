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
  opacity,
  padding,
  resizable,
  shapes,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, WidgetEnvironment } from "expo-widgets";

export interface TodaysPracticeProps {
  /** Which of the two colour stories to draw. Alternates by day so the home
   *  screen isn't the same picture every morning — see widget-sync.ts. */
  variation?: "warm" | "cool";
  /** What today's snippet is for — "Product Demo", "Handling Nerves". The
   *  framework it is built from ("PREP", "Feynman") is deliberately NOT here:
   *  that is craft detail for the screen, and on a tile it reads as jargon. */
  situationLabel?: string;
  oneLiner?: string;
  /** A harder trim of the same sentence. systemSmall has room for a phrase,
   *  not a sentence, and a tile that ends mid-word reads as broken. */
  oneLinerShort?: string;
  tip?: string;
  /** "Thu, Sep 18" — formatted in the app, which has the user's locale. */
  dateLabel?: string;
  /** `file://` paths inside the App Group — see lib/widget-assets.ts. One
   *  background plate and one character per family: the two tiles are 1:1 and
   *  2.14:1, and only the widget knows which one it is being drawn at. */
  plateUri?: string;
  plateSmallUri?: string;
  mascotUri?: string;
  mascotSmallUri?: string;
}

/**
 * Today's snippet, as a home-screen tile.
 *
 * Edge to edge. The background plate, the character and the stickers run into
 * all four corners and are cropped by the tile's own rounded rect; only the
 * text column is inset. Three things have to be true for that:
 *
 *   - `contentMarginsDisabled` on the widget's config (app.json). WidgetKit
 *     otherwise insets the whole view and the tile's `containerBackground`
 *     shows through as a white frame around the artwork.
 *   - Nothing in the tree may be larger than the tile. A flexible frame reports
 *     `max(childSize, proposedSize)` — it does not clamp — so a shape drawn
 *     230pt wide inside a 158pt tile made the whole ZStack 230pt wide, the text
 *     column was laid out against that, and every line lost its first few
 *     characters on a real home screen. `scripts/check-widgets.mjs` asserts the
 *     sizes so that cannot come back. A `resizable()` image is exempt in
 *     practice — it accepts whatever it is proposed — which is the other reason
 *     the background is a plate rather than a stack of shapes.
 *   - The shapes are a baked PNG, not SwiftUI geometry: they are organic, and
 *     a widget gets `Ellipse` and `Capsule` and nothing that bends.
 *
 * Type hierarchy, loudest to quietest: the title in SF Rounded bold (the
 * system's own geometric rounded face, so nothing has to be embedded in the
 * extension), the snippet in the default face at semibold, the tag in a
 * capsule, the date and tip in the default face at medium.
 *
 * EVERY prop is optional and defaulted below, because WidgetKit renders this
 * with no props at all in four situations — the widget-gallery preview, the
 * placeholder while a timeline loads, any time before the app's first
 * `updateSnapshot`, and when the App Group lookup misses. The provider passes
 * `entry.props ?? [:]`, so a missing prop is `undefined` rather than an error,
 * and `undefined.toUpperCase()` would throw inside the widget's JS runtime
 * where there is nothing to catch it.
 *
 * Note what may and may not be referenced here: the whole function body is
 * serialised to source and re-evaluated standalone (see babel-preset-expo's
 * widgets plugin), so anything declared *inside* it is available and anything
 * at module scope is not. That is why the palette is a local constant rather
 * than an import, and why the app resolves everything it alone knows — the
 * locale-formatted date, the situation's label, the artwork's paths.
 */
function TodaysPractice(props: TodaysPracticeProps, environment: WidgetEnvironment) {
  "widget";

  const isDark = environment.colorScheme === "dark";
  const isSmall = environment.widgetFamily === "systemSmall";

  const PALETTES = {
    warm: {
      base: "#FFFCF7",
      ink: "#262533",
      inkSoft: "#7E7A88",
      pillBg: "#FFD7E5",
      pillInk: "#D6336C",
      accent: "#7FA9F5",
      tipBg: "#F6EFE4",
    },
    cool: {
      base: "#FBFCFF",
      ink: "#262533",
      inkSoft: "#7E7A88",
      pillBg: "#D6E3FD",
      pillInk: "#3C67C4",
      accent: "#6E9BF0",
      tipBg: "#EEECF8",
    },
  };

  const palette = props.variation === "cool" ? PALETTES.cool : PALETTES.warm;

  // On a dark home screen the pastels are dimmed rather than swapped, so the
  // tile reads as the same tile in both appearances. The alpha goes in FRONT —
  // @expo/ui reads an 8-digit hex as #AARRGGBB, so appending it swaps channels.
  function dim(color: string, alpha: string) {
    return isDark ? `#${alpha}${color.slice(1)}` : color;
  }

  const ink = isDark ? "#F7F5F0" : palette.ink;
  const inkSoft = isDark ? "#B5F7F5F0" : palette.inkSoft;

  const rawTag = props.situationLabel;
  const situationLabel =
    typeof rawTag === "string" && rawTag.length > 0 ? rawTag : "Speaking";

  const rawLiner = isSmall ? props.oneLinerShort ?? props.oneLiner : props.oneLiner;
  const hasContent = typeof rawLiner === "string" && rawLiner.length > 0;
  const oneLiner = hasContent
    ? `“${rawLiner}”`
    : "Open Sailor to load today's practice.";

  const rawTip = props.tip;
  const tip = typeof rawTip === "string" && rawTip.length > 0 ? rawTip : "";

  const rawDate = props.dateLabel;
  const dateLabel = typeof rawDate === "string" ? rawDate : "";

  const rawPlate = isSmall ? props.plateSmallUri : props.plateUri;
  const plateUri = typeof rawPlate === "string" && rawPlate.length > 0 ? rawPlate : "";

  const rawMascot = isSmall ? props.mascotSmallUri : props.mascotUri;
  const mascotUri =
    typeof rawMascot === "string" && rawMascot.length > 0 ? rawMascot : "";

  // The character carries the tile. Capped at the narrow tile's own width so it
  // can never be the thing that sizes the stack.
  const mascotWidth = isSmall ? 124 : 158;
  // 512x360 is the art's own ratio — deriving the height keeps it undistorted.
  const mascotHeight = Math.round((mascotWidth * 360) / 512);

  return (
    <ZStack
      alignment="topLeading"
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
        // The plate covers this; it is what the tile falls back to while the
        // artwork is still being copied into the App Group on a fresh install.
        background(dim(palette.base, "F2")),
        containerBackground(dim(palette.base, "F2"), "widget"),
        // The character deliberately overhangs. This turns that into a crop.
        clipped(),
        // One tap target for the whole widget, which is what WidgetKit supports
        // for systemSmall/systemMedium anyway.
        widgetURL("sailor://daily-practice"),
      ]}
    >
      {/* Edge to edge, corner to corner: organic shapes and a confetti curl,
          baked at this family's own aspect. A resizable image takes exactly the
          size it is proposed, so it fills the tile without ever growing it. */}
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
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "bottomTrailing" }),
          ]}
        >
          <Image
            uiImage={mascotUri}
            modifiers={[
              resizable(),
              frame({ width: mascotWidth, height: mascotHeight }),
              // The eyes sit ~64% down the art, so the vertical bleed stops at
              // what keeps them above the tile's bottom edge — a character
              // cropped through the face reads as a glitch.
              offset({ x: isSmall ? 26 : 8, y: isSmall ? 10 : 16 }),
            ]}
          />
        </VStack>
      ) : null}

      {/* The only inset thing on the tile. */}
      <VStack
        alignment="leading"
        spacing={isSmall ? 7 : 6}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
          padding({ all: isSmall ? 15 : 16 }),
        ]}
      >
        <HStack spacing={isSmall ? 6 : 9}>
          <Image systemName="sparkle" size={isSmall ? 19 : 23} color={palette.accent} />
          <Text
            modifiers={[
              font({ size: isSmall ? 18 : 22, weight: "bold", design: "rounded" }),
              foregroundStyle(ink),
              lineLimit(2),
              minimumScaleFactor(0.85),
            ]}
          >
            Today&apos;s Practice
          </Text>
          <Spacer />
          {dateLabel && !isSmall ? (
            <Text
              modifiers={[font({ size: 12, weight: "medium" }), foregroundStyle(inkSoft)]}
            >
              {dateLabel}
            </Text>
          ) : null}
        </HStack>

        {/* Medium only. systemSmall is 158pt square and the snippet is worth
            more of it than a category is. */}
        {!isSmall ? (
          <HStack spacing={0}>
            <Text
              modifiers={[
                font({ size: 12.5, weight: "bold", design: "rounded" }),
                foregroundStyle(dim(palette.pillInk, "E8")),
                padding({ horizontal: 11, vertical: 4 }),
                background(dim(palette.pillBg, "4D"), shapes.capsule()),
              ]}
            >
              {situationLabel}
            </Text>
            <Spacer />
          </HStack>
        ) : null}

        <Text
          modifiers={[
            // The default face, not the rounded one — the snippet is a sentence
            // to read aloud and it should not compete with the title.
            font({ size: isSmall ? 13.5 : 16.5, weight: "semibold" }),
            foregroundStyle(hasContent ? ink : inkSoft),
            lineLimit(3),
            minimumScaleFactor(0.7),
            // Keeps the sentence off the character rather than wrapping under
            // it — a widget has no way to flow text around a shape.
            padding({ trailing: isSmall ? 30 : 136 }),
          ]}
        >
          {oneLiner}
        </Text>

        <Spacer />

        {tip && !isSmall ? (
          <HStack
            spacing={7}
            modifiers={[
              padding({ horizontal: 11, vertical: 7 }),
              background(dim(palette.tipBg, "59"), shapes.roundedRectangle({ cornerRadius: 13 })),
              frame({ width: 190, alignment: "leading" }),
            ]}
          >
            <Image systemName="lightbulb" size={15} color={inkSoft} />
            <Text
              modifiers={[
                font({ size: 11.5, weight: "medium" }),
                foregroundStyle(ink),
                lineLimit(2),
                minimumScaleFactor(0.8),
              ]}
            >
              {`Tip: ${tip}`}
            </Text>
            <Spacer />
          </HStack>
        ) : null}
      </VStack>
    </ZStack>
  );
}

export const TodaysPracticeWidget = createWidget<TodaysPracticeProps>(
  "TodaysPracticeWidget",
  TodaysPractice,
);
