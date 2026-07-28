import React from "react";
import { NativeText } from "./native-text";
import { Segment } from "../text-layout";

interface ParagraphProps {
  segments: Segment[];
  fontSize: number;
  lineHeightMultiplier: number;
  color: string;
  boldColor?: string;
  paragraphSpacing: number;
  justify?: boolean;
}

export const Paragraph = React.memo(
  ({
    segments,
    fontSize,
    lineHeightMultiplier,
    color,
    boldColor,
    paragraphSpacing,
    justify = false,
  }: ParagraphProps) => (
    <NativeText
      lines={[segments]}
      fontSize={fontSize}
      lineHeightMultiplier={lineHeightMultiplier}
      color={color}
      boldColor={boldColor}
      justify={justify}
      spacing={paragraphSpacing}
    />
  ),
);

Paragraph.displayName = "NativeParagraph";
