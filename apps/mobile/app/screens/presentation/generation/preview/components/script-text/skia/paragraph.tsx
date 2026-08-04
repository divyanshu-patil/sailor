import React from "react";
import { WrappedText } from "./wrapped-text";
import { FontSet, Segment } from "../text-layout";
import { RevealMode } from "../config";

interface ParagraphProps {
  segments: Segment[];
  fonts: FontSet;
  fontSize: number;
  lineHeightMultiplier: number;
  color: string;
  boldColor?: string;
  paragraphSpacing: number;
  justify?: boolean;
  width: number;
  reveal: RevealMode;
  delayMs: number;
}

export const Paragraph = React.memo(
  ({
    segments,
    fonts,
    fontSize,
    lineHeightMultiplier,
    color,
    boldColor,
    paragraphSpacing,
    justify = false,
    width,
    reveal,
    delayMs,
  }: ParagraphProps) => (
    <WrappedText
      lines={[segments]}
      fonts={fonts}
      fontSize={fontSize}
      lineHeightMultiplier={lineHeightMultiplier}
      color={color}
      boldColor={boldColor}
      justify={justify}
      spacing={paragraphSpacing}
      width={width}
      reveal={reveal}
      delayMs={delayMs}
    />
  ),
);

Paragraph.displayName = "Paragraph";
