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
  revealIndex: number;
  tint: string;
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
    revealIndex,
    tint,
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
      revealIndex={revealIndex}
      tint={tint}
    />
  ),
);

Paragraph.displayName = "Paragraph";
