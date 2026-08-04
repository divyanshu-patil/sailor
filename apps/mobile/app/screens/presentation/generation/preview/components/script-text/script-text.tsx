import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { matchFont } from "@shopify/react-native-skia";
import { fonts as fontFiles } from "@/constants/fonts";
import { Block, parseBlocks } from "@/utils/parseInlineMarkdown";
import { useColors } from "@/constants/theme";
import { FontSet } from "./text-layout";
import { RevealMode, REVEAL, SCRIPT_TEXT_VARIANT } from "./config";
import { headingScale, measureBlocks, sweptHeight } from "./block-metrics";
import { useProgressiveBlocks } from "./hooks/use-progressive-blocks";
import { DistortSweep } from "./skia/distort-reveal";
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
  const { height: windowHeight } = useWindowDimensions();

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

  /**
   * Where the blocks on the first screen sit. The distort sweep is sized and
   * aimed from this, and its length decides how many blocks mount in the first
   * commit — the sweep covers the screen, so the screen is what has to be there
   * when it starts.
   *
   * The budget is the window height rather than the body's visible height: the
   * body sits below a header whose size this component doesn't know, so erring
   * long is the safe direction. It costs at most one extra block above the fold
   * and never leaves a swept-past-but-empty gap.
   */
  const metrics = useMemo(() => {
    if (SCRIPT_TEXT_VARIANT !== "skia" || !skiaFonts || width <= 0) return null;
    return measureBlocks({
      blocks,
      fonts: skiaFonts,
      width,
      fontSize,
      lineHeightMultiplier,
      paragraphSpacing,
      quoteSpacing,
      quoteIndent,
      justify,
      budget: windowHeight,
      maxBlocks: REVEAL.maxInitialBlockCount,
    });
  }, [
    blocks,
    skiaFonts,
    width,
    fontSize,
    lineHeightMultiplier,
    paragraphSpacing,
    quoteSpacing,
    quoteIndent,
    justify,
    windowHeight,
  ]);

  // Until the body is measured there is nothing on screen to count — the Skia
  // blocks all render null without a width — so the fallback only ever covers
  // frames that draw nothing.
  const distortCount = metrics?.length ?? REVEAL.fallbackBlockCount;

  // Height the cascade travels, and the delay the last block in it waits for.
  const sweepHeight = metrics ? sweptHeight(metrics) : 0;
  const lastDelayMs =
    metrics && metrics.length > 1 ? REVEAL.cascadeWindowMs : 0;

  // TEMPORARY DIAGNOSTIC — delete once the script screen's reveal is confirmed.
  useEffect(() => {
    if (!__DEV__) return;
    console.log("[script-text]", {
      width,
      blocks: blocks.length,
      fonts: skiaFonts !== null,
      metrics: metrics?.length ?? null,
      distortCount,
    });
  }, [width, blocks.length, skiaFonts, metrics, distortCount]);

  /**
   * A script is a document, not a feed — it lives inside the preview screen's
   * ScrollView, which is exactly where a virtualised list can't measure itself.
   * The list is a plain map; what keeps it cheap is that the blocks arrive in
   * batches rather than all in one commit.
   */
  const visibleBlocks = useProgressiveBlocks(blocks, {
    initialCount: distortCount,
    chunkSize: REVEAL.chunkSize,
    chunkIntervalMs: REVEAL.chunkIntervalMs,
    // Version 1 holds the rest of the script back until the distort sweep has
    // finished. Version 2 has no sweep to wait on.
    firstChunkDelayMs:
      SCRIPT_TEXT_VARIANT === "skia"
        ? REVEAL.startDelayMs +
          REVEAL.cascadeWindowMs +
          REVEAL.distortDurationMs +
          REVEAL.distortTeardownMs
        : REVEAL.chunkIntervalMs,
  });

  const renderBlock = (block: Block, index: number) => {
    // Blocks on the first screen get the sweep; everything streaming in behind
    // it just fades, which is both cheaper and less busy to watch.
    const metric = metrics?.[index];
    const reveal: RevealMode = metric ? "distort" : "fade";
    // Each block sweeps its own canvas; scaling its offset down the page into
    // the cascade window is what turns those separate sweeps into one reveal
    // travelling from the top of the screen to the bottom.
    const delayMs =
      metric && sweepHeight > 0
        ? (metric.top / sweepHeight) * REVEAL.cascadeWindowMs
        : 0;

    /**
     * Headings render through the paragraph renderers rather than getting their
     * own components: a heading is one line of styled text, and both variants
     * already lay that out. Segments are forced bold and the size is scaled by
     * level, which is the whole visual difference. Doing it here keeps the Skia
     * and native paths from each needing a fourth component to maintain.
     */
    if (block.type === "heading") {
      const headingSize = fontSize * headingScale(block.level);
      const segments = block.segments.map((segment) => ({
        ...segment,
        bold: true,
      }));

      if (SCRIPT_TEXT_VARIANT === "native") {
        return (
          <NativeParagraph
            key={index}
            segments={segments}
            fontSize={headingSize}
            lineHeightMultiplier={lineHeightMultiplier}
            color={colors.rust}
            boldColor={colors.rust}
            paragraphSpacing={paragraphSpacing}
            justify={false}
          />
        );
      }

      if (!skiaFonts || width <= 0) return null;
      return (
        <SkiaParagraph
          key={index}
          segments={segments}
          fonts={skiaFonts}
          fontSize={headingSize}
          lineHeightMultiplier={lineHeightMultiplier}
          color={colors.rust}
          boldColor={colors.rust}
          paragraphSpacing={paragraphSpacing}
          justify={false}
          width={width}
          reveal={reveal}
          delayMs={delayMs}
        />
      );
    }

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
        delayMs={delayMs}
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
        delayMs={delayMs}
      />
    );
  };

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <DistortSweep
        ready={metrics !== null}
        content={blocks}
        lastDelayMs={lastDelayMs}
        tint={colors.rust}
      >
        {visibleBlocks.map(renderBlock)}
      </DistortSweep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 100,
  },
});
