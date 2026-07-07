import React from "react";
import { WrappedText } from "./wrapped-text";
import { FontSet } from "./text-layout";

type Segment = { text: string; bold: boolean; italic: boolean };

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
    borderWidth = 3,
    borderColor = "#B75C5C",
    justify = false,
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
        contentWidthOffset={indent}
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
