import React from "react";
import { NativeText } from "./native-text";
import { Segment } from "../text-layout";

interface QuoteProps {
  lines: Segment[][];
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
    fontSize,
    lineHeightMultiplier,
    color,
    blockSpacing,
    indent = 16,
    borderWidth = 3,
    borderColor = "#B75C5C",
    justify = false,
  }: QuoteProps) => (
    <NativeText
      lines={lines}
      fontSize={fontSize}
      lineHeightMultiplier={lineHeightMultiplier}
      color={color}
      justify={justify}
      spacing={blockSpacing}
      style={{
        paddingLeft: indent,
        borderLeftWidth: borderWidth,
        borderLeftColor: borderColor,
      }}
    />
  ),
);

Quote.displayName = "NativeQuote";
