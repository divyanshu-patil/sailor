import { Block } from "@/utils/parseInlineMarkdown";
import { FontSet, layoutText, Segment } from "./text-layout";
import { QUOTE_BORDER_WIDTH } from "./config";

/**
 * A heading is one line of styled text drawn by the paragraph renderers at a
 * scaled size. Shared with `script-text.tsx` so the size a heading is measured
 * at can't drift from the size it's drawn at.
 */
export const headingScale = (level: number) => (level <= 1 ? 1.5 : 1.22);

export interface BlockMetric {
  /** Top edge of this block's canvas, relative to the top of the body. */
  top: number;
  /** Left edge of the canvas inside the body — the quote rule and its indent. */
  left: number;
  height: number;
}

export interface MeasureBlocksOptions {
  blocks: Block[];
  fonts: FontSet;
  /** Width of the body, as measured by the container's onLayout. */
  width: number;
  fontSize: number;
  lineHeightMultiplier: number;
  paragraphSpacing: number;
  quoteSpacing: number;
  quoteIndent: number;
  justify: boolean;
  /** Height to fill. Measuring stops at the first block that starts below it. */
  budget: number;
  /** Hard ceiling on how many blocks are measured, and so on how many canvases
   *  the first commit can mount. */
  maxBlocks: number;
}

/**
 * Lays out blocks from the top until the body has filled `budget`, and reports
 * where each one sits.
 *
 * Two things need this. The reveal needs to know how many blocks are on the
 * first screen, because those are the ones that get the distort sweep rather
 * than a fade. The sweep itself needs each block's offset, because it is one
 * wavefront crossing the whole screen and every block draws into its own canvas
 * — each has to place the shared centre in its own local coordinates.
 *
 * Measuring is the same `layoutText` the renderer runs, so the numbers are the
 * ones the canvases will actually use; the early exit is what keeps a forty
 * block script from laying all forty out to find the fold.
 */
export function measureBlocks({
  blocks,
  fonts,
  width,
  fontSize,
  lineHeightMultiplier,
  paragraphSpacing,
  quoteSpacing,
  quoteIndent,
  justify,
  budget,
  maxBlocks,
}: MeasureBlocksOptions): BlockMetric[] {
  const metrics: BlockMetric[] = [];
  let top = 0;

  for (let index = 0; index < blocks.length && index < maxBlocks; index++) {
    // Everything from here down mirrors `renderBlock` in script-text.tsx: same
    // source lines, same size, same wrap width, same trailing gap.
    const block = blocks[index];

    let lines: Segment[][];
    let blockFontSize = fontSize;
    let left = 0;
    // How much narrower the glyphs wrap. Not the same as `left`: the renderer
    // insets a quote's canvas by the rule *and* the indent but only takes the
    // indent off the wrap width, so the two have to be tracked separately or
    // the measured height stops matching the drawn one.
    let wrapInset = 0;
    let spacing = paragraphSpacing;
    let blockJustify = justify;

    if (block.type === "heading") {
      lines = [block.segments];
      blockFontSize = fontSize * headingScale(block.level);
      blockJustify = false;
    } else if (block.type === "quote") {
      lines = block.lines;
      left = quoteIndent + QUOTE_BORDER_WIDTH;
      wrapInset = quoteIndent;
      spacing = quoteSpacing;
      blockJustify = false;
    } else {
      lines = [block.segments];
    }

    const contentWidth = Math.max(width - wrapInset, 0);
    const lineHeight = blockFontSize * lineHeightMultiplier;
    const { height } = layoutText(
      lines,
      fonts,
      contentWidth,
      lineHeight,
      blockJustify,
      blockFontSize,
    );

    metrics.push({ top, left, height });
    top += height + spacing;

    // The next block would start below the fold, so it is not on this screen.
    if (top >= budget) break;
  }

  return metrics;
}

/** Height the sweep has to cross: the top of the body down to the bottom of the
 *  last block on screen. Blocks that overhang the fold are covered in full —
 *  a wavefront that stopped at the fold would leave a visible seam. */
export const sweptHeight = (metrics: BlockMetric[]) => {
  const last = metrics[metrics.length - 1];
  return last ? last.top + last.height : 0;
};
