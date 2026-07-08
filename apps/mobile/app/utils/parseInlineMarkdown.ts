type Segment = { text: string; bold: boolean; italic: boolean };

export function parseInlineMarkdown(line: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) {
      segments.push({ text: match[1], bold: true, italic: false });
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], bold: false, italic: true });
    } else if (match[3] !== undefined) {
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

export type Block = QuoteBlock | ParagraphBlock;

const QUOTE_PREFIX = /^\s*>\s?/;

function isQuoteLine(line: string): boolean {
  return QUOTE_PREFIX.test(line);
}

function stripQuotePrefix(line: string): string {
  return line.replace(QUOTE_PREFIX, "");
}

/**
 * Splits raw script text into blocks: consecutive `> ` lines become a
 * single QuoteBlock (each line kept separate so line breaks are preserved),
 * everything else becomes ParagraphBlocks (split on blank lines, joined
 * with a space since normal paragraphs wrap freely).
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
