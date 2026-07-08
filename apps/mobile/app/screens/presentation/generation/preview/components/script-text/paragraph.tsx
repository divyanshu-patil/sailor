import React from "react";
import { WrappedText } from "./wrapped-text";
import { FontSet, Segment } from "./text-layout";

interface ParagraphProps {
  segments: Segment[];
  fonts: FontSet;
  fontSize: number;
  lineHeightMultiplier: number;
  color: string;
  boldColor?: string;
  paragraphSpacing: number;
  justify?: boolean;
  index: number;
  delay?: number;
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
    index,
    delay,
  }: ParagraphProps) => (
    <WrappedText
      index={index}
      delay={delay}
      lines={[segments]}
      fonts={fonts}
      fontSize={fontSize}
      lineHeightMultiplier={lineHeightMultiplier}
      color={color}
      boldColor={boldColor}
      justify={justify}
      spacing={paragraphSpacing}
    />
  ),
);

Paragraph.displayName = "Paragraph";
