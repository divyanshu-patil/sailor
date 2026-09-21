import { parseInlineMarkdown, type Segment } from "@/utils/parseInlineMarkdown";
import { splitSentences } from "./sentences";

/**
 * A script, cut into the units a teleprompter scrolls past.
 *
 * Not the same cut as `parseBlocks`, which the reading screens use: there a
 * paragraph is one block of flowing text, here every sentence is its own line
 * because one sentence is what the reader is looking at. The markdown is
 * parsed per sentence with the same `parseInlineMarkdown`, so bold stress and
 * italic delivery notes survive the split.
 */
export type PromptLineKind =
  /** A sentence of the script itself. The big type. */
  | "line"
  /** A `#` heading — `[HOOK] · ~1m 30s`. Reference, shown small. */
  | "note"
  /** A `> ` block: a pause, a beat, a stage direction. In between. */
  | "aside";

export interface PromptLine {
  kind: PromptLineKind;
  text: string;
  segments: Segment[];
  /** First line of a new paragraph, so it takes the wider gap above. */
  startsBlock: boolean;
}

const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const QUOTE = /^\s*>\s?/;

export function toPromptLines(script: string): PromptLine[] {
  const lines: PromptLine[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;
    splitSentences(text).forEach((sentence, index) => {
      lines.push({
        kind: "line",
        text: sentence,
        segments: parseInlineMarkdown(sentence),
        startsBlock: index === 0,
      });
    });
  };

  for (const raw of script.split("\n")) {
    const heading = HEADING.exec(raw);
    if (heading) {
      flushParagraph();
      // Trailing #s are decoration; the asterisks would read as literal text
      // at note size, and a beat marker has no emphasis to carry anyway.
      const text = heading[2]
        .replace(/\s+#+\s*$/, "")
        .replace(/\*/g, "")
        .trim();
      if (text) {
        lines.push({ kind: "note", text, segments: [], startsBlock: true });
      }
      continue;
    }

    if (QUOTE.test(raw)) {
      flushParagraph();
      const text = raw.replace(QUOTE, "").trim();
      if (text) {
        lines.push({
          kind: "aside",
          text,
          segments: parseInlineMarkdown(text),
          startsBlock: true,
        });
      }
      continue;
    }

    if (!raw.trim()) {
      flushParagraph();
      continue;
    }

    paragraph.push(raw.trim());
  }

  flushParagraph();
  return lines;
}
