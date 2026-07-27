import React, { useCallback, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { matchFont } from "@shopify/react-native-skia";
import { fonts as fontFiles } from "@/constants/fonts";
import { Block, parseBlocks } from "@/utils/parseInlineMarkdown";
import { useColors } from "@/constants/theme";
import { FontSet } from "./text-layout";
import { RevealMode, REVEAL, SCRIPT_TEXT_VARIANT } from "./config";
import { useProgressiveBlocks } from "./hooks/use-progressive-blocks";
import { Paragraph as SkiaParagraph } from "./skia/paragraph";
import { Quote as SkiaQuote } from "./skia/quote";
import { Paragraph as NativeParagraph } from "./native/paragraph";
import { Quote as NativeQuote } from "./native/quote";

export interface ScriptTextProps {
  script: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeightMultiplier?: number;
  paragraphSpacing?: number;
  quoteSpacing?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  justify?: boolean;
  quoteColor?: string;
  quoteIndent?: number;
  quoteBorderColor?: string;
  staggerDelay?: number;
}

export default function ScriptText({
  script,
  fontFamily = fontFiles.newsreader.regular,
  fontSize = 20,
  lineHeightMultiplier = 1.5,
  paragraphSpacing = 40,
  quoteSpacing = 20,
  color = "#222",
  style,
  justify = true,
  quoteColor = "#B75C5C",
  quoteIndent = 16,
  quoteBorderColor = "#B75C5C66",
}: ScriptTextProps) {
  const { colors } = useColors();

  const blocks = useMemo(() => parseBlocks(script), [script]);

  /**
   * A script is a document, not a feed — it lives inside the preview screen's
   * ScrollView, which is exactly where a virtualised list can't measure itself.
   * The list is a plain map; what keeps it cheap is that the blocks arrive in
   * batches rather than all in one commit.
   */
  const visibleBlocks = useProgressiveBlocks(blocks, {
    initialCount: REVEAL.initialBlockCount,
    chunkSize: REVEAL.chunkSize,
    chunkIntervalMs: REVEAL.chunkIntervalMs,
    // Version 1 holds the rest of the script back until the distort sweep on
    // the first chunk has finished. Version 2 has no sweep to wait on.
    firstChunkDelayMs:
      SCRIPT_TEXT_VARIANT === "skia"
        ? REVEAL.distortDurationMs +
          REVEAL.initialBlockCount * REVEAL.distortStaggerMs
        : REVEAL.chunkIntervalMs,
  });

  // Measured once for the whole body. Every block is the same width, and the
  // Skia renderer needs a number before it can lay glyphs out.
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((prev) => (prev !== next ? next : prev));
  }, []);

  // Only Version 1 needs Skia fonts. The hook itself stays unconditional so
  // hook order is stable; the work inside it is what's skipped.
  const skiaFonts = useMemo<FontSet | null>(() => {
    if (SCRIPT_TEXT_VARIANT !== "skia") return null;
    return {
      regular: matchFont({ fontFamily, fontSize }),
      bold: matchFont({ fontFamily, fontWeight: "600", fontSize }),
      italic: matchFont({ fontFamily, fontStyle: "italic", fontSize }),
      boldItalic: matchFont({
        fontFamily,
        fontStyle: "italic",
        fontWeight: "600",
        fontSize,
      }),
    };
  }, [fontFamily, fontSize]);

  const renderBlock = (block: Block, index: number) => {
    // Blocks in the first chunk get the sweep; everything streaming in behind
    // it just fades, which is both cheaper and less busy to watch.
    const reveal: RevealMode =
      index < REVEAL.initialBlockCount ? "distort" : "fade";

    if (SCRIPT_TEXT_VARIANT === "native") {
      return block.type === "quote" ? (
        <NativeQuote
          key={index}
          lines={block.lines}
          fontSize={fontSize}
          lineHeightMultiplier={lineHeightMultiplier}
          color={quoteColor}
          blockSpacing={quoteSpacing}
          indent={quoteIndent}
          borderColor={quoteBorderColor}
        />
      ) : (
        <NativeParagraph
          key={index}
          segments={block.segments}
          fontSize={fontSize}
          lineHeightMultiplier={lineHeightMultiplier}
          color={color}
          boldColor={colors.rust}
          paragraphSpacing={paragraphSpacing}
          justify={justify}
        />
      );
    }

    if (!skiaFonts || width <= 0) return null;

    return block.type === "quote" ? (
      <SkiaQuote
        key={index}
        lines={block.lines}
        fonts={skiaFonts}
        fontSize={fontSize}
        lineHeightMultiplier={lineHeightMultiplier}
        color={quoteColor}
        blockSpacing={quoteSpacing}
        indent={quoteIndent}
        borderColor={quoteBorderColor}
        width={width}
        reveal={reveal}
        revealIndex={index}
        tint={colors.rust}
      />
    ) : (
      <SkiaParagraph
        key={index}
        segments={block.segments}
        fonts={skiaFonts}
        fontSize={fontSize}
        lineHeightMultiplier={lineHeightMultiplier}
        color={color}
        boldColor={colors.rust}
        paragraphSpacing={paragraphSpacing}
        justify={justify}
        width={width}
        reveal={reveal}
        revealIndex={index}
        tint={colors.rust}
      />
    );
  };

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {visibleBlocks.map(renderBlock)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 100,
  },
});
