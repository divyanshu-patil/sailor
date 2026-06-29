import { ScrollView, StyleSheet, Text } from "react-native";
import React, { useMemo } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { colord } from "colord";
import { parseInlineMarkdown } from "@/utils/parseInlineMarkdown";
import Clipboard from "@react-native-clipboard/clipboard";
import { fonts } from "@/constants/fonts";

type ScriptTextParams = {
  script: string;
  color: string;
};

// ---------- Data ----------

type ScriptData = {
  id: string;
  text: string;
};

const SCRIPTS: ScriptData[] = [
  {
    id: "1",
    text: `Your CPU speaks at the **speed of light**. Your hard disk speaks at the *speed of a bicycle*. And somehow — they have to talk to each other.
Every single time you open a file, plug in a keyboard, or save your work.
The system that makes that conversation possible — **without crashing**, *without data loss*, without freezing your processor — is the **Advanced I/O System**.
And understanding it is understanding the **backbone** of every computer ever built.`,
  },
  {
    id: "2",
    text: `Revenue is up **23% quarter-over-quarter**. Churn dropped to *4.2%* — the lowest we've ever seen.
The roadmap ahead is **ambitious but clear**.
We're not just hitting numbers. We're *building something that lasts*.`,
  },
];

function getScriptById(id: string): ScriptData | null {
  return SCRIPTS.find((s) => s.id === id) ?? null;
}

// ---------- Components ----------

const ScriptLine = ({ line, color }: { line: string; color: string }) => {
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
                  { color: textColor, backgroundColor: bgHighlightColor },
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

const ScriptTextScreen = () => {
  const params = useLocalSearchParams<ScriptTextParams>();
  const script = useMemo(
    () => ({
      id: params.script,
      color: params.color,
    }),
    [params],
  );
  const screenColor = colord(script.color).lighten(0.18).toHex();
  const scriptText = getScriptById(script.id);
  const lines =
    scriptText?.text.split("\n").filter((l) => l.trim() !== "") ?? [];

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"rectangle.portrait.on.rectangle.portrait"}
          onPress={() =>
            lines.length > 0 && Clipboard.setString(scriptText?.text as string)
          }
        />
      </Stack.Toolbar>
      <ScrollView
        style={{ backgroundColor: screenColor }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        {lines.length === 0 ? (
          <Text style={styles.empty}>No script found.</Text>
        ) : (
          lines.map((line, i) => (
            <ScriptLine key={i} line={line} color={params.color} />
          ))
        )}
      </ScrollView>
    </>
  );
};

export default ScriptTextScreen;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 28,
    alignItems: "center",
  },
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
  empty: {
    fontFamily: fonts.amarna.regular,
    fontSize: 16,
    opacity: 0.4,
    textAlign: "center",
    marginTop: 80,
  },
});
