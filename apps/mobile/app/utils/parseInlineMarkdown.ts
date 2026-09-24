export type Segment = { text: string; bold: boolean; italic: boolean };

export function parseInlineMarkdown(line: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) {
      segments.push({ text: match[1], bold: true, italic: false });
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], bold: false, italic: true });
    } else {
      // The third alternative is the only one left: the pattern always
      // matches exactly one of its three groups.
      segments.push({ text: match[3], bold: false, italic: false });
    }
  }
  return segments;
}

export type QuoteBlock = {
  type: "quote";
  lines: Segment[][];
};

export type ParagraphBlock = {
  type: "paragraph";
  segments: Segment[];
};

/**
 * An ATX heading (`## [HOOK] · ~30s`).
 *
 * The generator writes one of these above every beat, and they're how the
 * presenter navigates the script — without a block type for them they fell
 * through to the paragraph branch and rendered as literal `##` text mid-prose.
 * `level` is the number of `#`, so the renderer can size them; `label` is the
 * bracketed beat name pulled out separately, since it's the part worth
 * emphasising.
 */
export type HeadingBlock = {
  type: "heading";
  level: number;
  segments: Segment[];
  /** The `[HOOK]` part, without brackets — null on a heading that isn't one of
   *  the generator's beat markers. */
  label: string | null;
};

export type Block = QuoteBlock | ParagraphBlock | HeadingBlock;

const QUOTE_PREFIX = /^\s*>\s?/;
// Up to three leading spaces is still a heading in CommonMark; four makes it a
// code block. The space after the #s is required — `#hashtag` is not a heading.
const HEADING_PATTERN = /^ {0,3}(#{1,6})\s+(.*)$/;
const BEAT_LABEL_PATTERN = /^\[([^\]]+)\]/;

function isQuoteLine(line: string): boolean {
  return QUOTE_PREFIX.test(line);
}

function stripQuotePrefix(line: string): string {
  return line.replace(QUOTE_PREFIX, "");
}

function parseHeading(line: string): HeadingBlock | null {
  const match = HEADING_PATTERN.exec(line);
  if (!match) return null;

  // Trailing #s are decoration in ATX headings and aren't part of the text.
  const text = match[2].replace(/\s+#+\s*$/, "").trim();
  if (!text) return null;

  return {
    type: "heading",
    level: match[1].length,
    segments: parseInlineMarkdown(text),
    label: BEAT_LABEL_PATTERN.exec(text)?.[1] ?? null,
  };
}

/**
 * Splits raw script text into blocks: `#`-prefixed lines become HeadingBlocks,
 * consecutive `> ` lines become a single QuoteBlock (each line kept separate so
 * line breaks are preserved), and everything else becomes ParagraphBlocks
 * (split on blank lines, joined with a space since normal paragraphs wrap
 * freely).
 */
export function parseBlocks(script: string): Block[] {
  const blocks: Block[] = [];
  const rawLines = script.split("\n");

  let i = 0;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (text.length > 0) {
      blocks.push({
        type: "paragraph",
        segments: parseInlineMarkdown(text),
      });
    }
  };

  while (i < rawLines.length) {
    const line = rawLines[i];

    const heading = parseHeading(line);
    if (heading) {
      // A heading always starts a new block — anything buffered belongs to the
      // paragraph above it, not to the section it introduces.
      flushParagraph();
      blocks.push(heading);
      i++;
      continue;
    }

    if (isQuoteLine(line)) {
      // flush any pending paragraph text before starting a quote block
      flushParagraph();

      const quoteLines: Segment[][] = [];
      while (i < rawLines.length && isQuoteLine(rawLines[i])) {
        const content = stripQuotePrefix(rawLines[i]);
        quoteLines.push(parseInlineMarkdown(content));
        i++;
      }

      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    if (line.trim() === "") {
      // blank line = paragraph break
      flushParagraph();
      i++;
      continue;
    }

    paragraphBuffer.push(line.trim());
    i++;
  }

  flushParagraph();

  return blocks;
}
