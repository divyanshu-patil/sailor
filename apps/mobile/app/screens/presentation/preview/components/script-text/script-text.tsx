import React, { useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { matchFont } from "@shopify/react-native-skia";
import { fonts as fontFiles } from "@/constants/fonts";
import { Paragraph } from "./paragraph";
import { Quote } from "./quote";
import { Block, parseBlocks } from "@/utils/parseInlineMarkdown";
import { FontSet } from "./text-layout";

export interface ScriptTextProps {
  script: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeightMultiplier?: number;
  paragraphSpacing?: number;
  quoteSpacing?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  justify?: boolean;
  quoteColor?: string;
  quoteIndent?: number;
  quoteBorderColor?: string;
}

export default function ScriptText({
  script,
  fontFamily = fontFiles.newsreader.regular,
  fontSize = 20,
  lineHeightMultiplier = 1.5,
  paragraphSpacing = 40,
  quoteSpacing = 20,
  color = "#222",
  style,
  justify = true,
  quoteColor = "#B75C5C",
  quoteIndent = 16,
  quoteBorderColor = "#B75C5C66",
}: ScriptTextProps) {
  const fonts: FontSet = useMemo(
    () => ({
      regular: matchFont({
        fontFamily,
        fontSize,
      }),
      bold: matchFont({
        fontFamily,
        fontWeight: "600",
        fontSize,
      }),
      italic: matchFont({
        fontFamily,
        fontStyle: "italic",
        fontSize,
      }),
      boldItalic: matchFont({
        fontFamily,
        fontStyle: "italic",
        fontWeight: "600",
        fontSize,
      }),
    }),
    [fontFamily, fontSize],
  );

  const blocks = useMemo(() => parseBlocks(script), [script]);

  return (
    <View style={[styles.container, style]}>
      <FlashList
        data={blocks}
        keyExtractor={(_, index) => index.toString()}
        removeClippedSubviews
        renderItem={({ item }: { item: Block }) => {
          if (item.type === "quote") {
            return (
              <Quote
                lines={item.lines}
                fonts={fonts}
                fontSize={fontSize}
                lineHeightMultiplier={lineHeightMultiplier}
                color={quoteColor}
                blockSpacing={quoteSpacing}
                indent={quoteIndent}
                borderColor={quoteBorderColor}
              />
            );
          }

          return (
            <Paragraph
              segments={item.segments}
              fonts={fonts}
              fontSize={fontSize}
              lineHeightMultiplier={lineHeightMultiplier}
              color={color}
              paragraphSpacing={paragraphSpacing}
              justify={justify}
              boldColor="#B75C5C"
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 100,
  },
});
