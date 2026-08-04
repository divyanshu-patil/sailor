import React from "react";
import { WrappedText } from "./wrapped-text";
import { FontSet, Segment } from "../text-layout";
import { QUOTE_BORDER_WIDTH, RevealMode } from "../config";

interface QuoteProps {
  lines: Segment[][];
  fonts: FontSet;
  fontSize: number;
  lineHeightMultiplier: number;
  color: string;
  blockSpacing: number;
  indent?: number;
  borderWidth?: number;
  borderColor?: string;
  justify?: boolean;
  width: number;
  reveal: RevealMode;
  delayMs: number;
}

export const Quote = React.memo(
  ({
    lines,
    fonts,
    fontSize,
    lineHeightMultiplier,
    color,
    blockSpacing,
    indent = 16,
    borderWidth = QUOTE_BORDER_WIDTH,
    borderColor = "#B75C5C",
    justify = false,
    width,
    reveal,
    delayMs,
  }: QuoteProps) => {
    return (
      <WrappedText
        lines={lines}
        fonts={fonts}
        fontSize={fontSize}
        lineHeightMultiplier={lineHeightMultiplier}
        color={color}
        justify={justify}
        spacing={blockSpacing}
        width={width}
        contentWidthOffset={indent}
        reveal={reveal}
        delayMs={delayMs}
        style={{
          paddingLeft: indent,
          borderLeftWidth: borderWidth,
          borderLeftColor: borderColor,
        }}
      />
    );
  },
);

Quote.displayName = "Quote";
