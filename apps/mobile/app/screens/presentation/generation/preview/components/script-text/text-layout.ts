import { SkFont } from "@shopify/react-native-skia";

export type Segment = { text: string; bold: boolean; italic: boolean };

export interface FontSet {
  regular: SkFont;
  bold: SkFont;
  italic: SkFont;
  boldItalic: SkFont;
}

export interface WrappedWord {
  text: string;
  x: number;
  y: number;
  font: SkFont;
  bold: boolean; // <-- new, lets the renderer pick the right color
}

function pickFont(fonts: FontSet, bold: boolean, italic: boolean): SkFont {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

function measure(font: SkFont, text: string) {
  return font.measureText(text).width;
}

function safeSpaceWidth(font: SkFont, fontSize: number): number {
  const raw = measure(font, " ");
  return raw > 0.5 ? raw : fontSize * 0.25;
}

interface StyledWord {
  text: string;
  font: SkFont;
  bold: boolean;
}

function segmentsToWords(segments: Segment[], fonts: FontSet): StyledWord[] {
  const words: StyledWord[] = [];
  for (const seg of segments) {
    const font = pickFont(fonts, seg.bold, seg.italic);
    const parts = seg.text.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      words.push({ text: part, font, bold: seg.bold });
    }
  }
  return words;
}

function wrapStyledWords(
  words: StyledWord[],
  width: number,
  regularFont: SkFont,
  fontSize: number,
): StyledWord[][] {
  const lines: StyledWord[][] = [];
  let current: StyledWord[] = [];
  let currentWidth = 0;
  const spaceWidth = safeSpaceWidth(regularFont, fontSize);

  for (const word of words) {
    const wordWidth = measure(word.font, word.text);
    const extra = current.length > 0 ? spaceWidth : 0;

    if (current.length > 0 && currentWidth + extra + wordWidth > width) {
      lines.push(current);
      current = [word];
      currentWidth = wordWidth;
    } else {
      current.push(word);
      currentWidth += extra + wordWidth;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

export function layoutText(
  sourceLines: Segment[][],
  fonts: FontSet,
  width: number,
  lineHeight: number,
  justify: boolean,
  fontSize: number,
): { words: WrappedWord[]; height: number } {
  const metrics = fonts.regular.getMetrics();
  const ascent = -metrics.ascent;
  const descent = metrics.descent;

  let y = ascent;
  let lastBaselineY = ascent;
  const result: WrappedWord[] = [];
  let hasContent = false;

  for (const segments of sourceLines) {
    const styledWords = segmentsToWords(segments, fonts);

    if (styledWords.length === 0) {
      y += lineHeight;
      continue;
    }

    const wrappedLines = wrapStyledWords(
      styledWords,
      width,
      fonts.regular,
      fontSize,
    );

    wrappedLines.forEach((lineWords, idx) => {
      const isLastOfSource = idx === wrappedLines.length - 1;
      const spaceWidth = safeSpaceWidth(fonts.regular, fontSize);
      const wordWidths = lineWords.map((w) => measure(w.font, w.text));
      const totalWordsWidth = wordWidths.reduce((a, b) => a + b, 0);

      const shouldJustify = justify && !isLastOfSource && lineWords.length > 1;
      const gap = shouldJustify
        ? (width - totalWordsWidth) / (lineWords.length - 1)
        : spaceWidth;

      let x = 0;
      lineWords.forEach((word, i) => {
        result.push({
          text: word.text,
          x,
          y,
          font: word.font,
          bold: word.bold,
        });
        x += wordWidths[i] + gap;
      });

      lastBaselineY = y;
      hasContent = true;
      y += lineHeight;
    });
  }

  const height = hasContent ? lastBaselineY + descent : lineHeight;

  return { words: result, height };
}
