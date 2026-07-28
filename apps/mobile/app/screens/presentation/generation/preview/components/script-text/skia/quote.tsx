import React from "react";
import { WrappedText } from "./wrapped-text";
import { FontSet, Segment } from "../text-layout";
import { RevealMode } from "../config";

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
  revealIndex: number;
  tint: string;
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
    width,
    reveal,
    revealIndex,
    tint,
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
        revealIndex={revealIndex}
        tint={tint}
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
