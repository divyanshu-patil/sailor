import { fonts } from "@/constants/fonts";
import { parseInlineMarkdown } from "@/utils/parseInlineMarkdown";
import { colord } from "colord";
import { StyleSheet, Text } from "react-native";

interface ScriptLineProps {
  line: string;
  color: string;
  shouldHighlightBold?: boolean;
}
export const ScriptLine = ({
  line,
  color,
  shouldHighlightBold,
}: ScriptLineProps) => {
  const segments = parseInlineMarkdown(line);
  const textColor = colord(color).darken(0.4).desaturate(0.3).toHex();
  const bgHighlightColor = colord(color).lighten(0.15).toHex();

  return (
    <Text style={styles.line}>
      {segments.map((seg, i) => {
        if (seg.bold) {
          return (
            <Text key={i}>
              <Text
                style={[
                  styles.segment,
                  styles.bold,
                  { color: textColor },
                  shouldHighlightBold && { backgroundColor: bgHighlightColor },
                ]}
              >
                {`${seg.text}`}
              </Text>
            </Text>
          );
        }
        return (
          <Text
            key={i}
            style={[
              styles.segment,
              { color: textColor },
              seg.italic && styles.italic,
            ]}
          >
            {seg.text}
          </Text>
        );
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  line: {
    textAlign: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  segment: {
    fontFamily: fonts.amarna.regular,
    fontSize: 30,
    // lineHeight: 32,
  },
  bold: {
    fontFamily: fonts.amarna.bold,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 15,
  },
  italic: {
    fontStyle: "italic",
  },
});
