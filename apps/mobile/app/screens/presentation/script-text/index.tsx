import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import React, { useEffect, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { colord } from "colord";
import Clipboard from "@react-native-clipboard/clipboard";
import { fonts } from "@/constants/fonts";
import { useDeck } from "@/hooks";
import { haptics } from "@/lib/haptics";
import ScriptText from "../generation/preview/components/script-text/script-text";

type ScriptTextParams = {
  /** The deck id. Named `script` because that's what the detail screen's Link
   *  passes; the deck id is the script's id everywhere in this flow. */
  script: string;
  color: string;
};

const ScriptTextScreen = () => {
  const { script: deckId, color } = useLocalSearchParams<ScriptTextParams>();

  // The screen used to look the script up in a hardcoded two-entry array keyed
  // on ids "1" and "2", so a real deck id never matched and every deck rendered
  // "No script found." The script comes off the deck row now — from SQLite on
  // the first frame, refreshed from the detail endpoint behind it.
  const { script, isLoading } = useDeck({ deckId });

  // Copy has no visible result of its own — the clipboard is off-screen — so
  // the button reports it by becoming a tick for a second. Long enough to be
  // read, short enough that the control is back to normal before anyone
  // reaches for it again.
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1000);
    // Cleared on unmount and on a re-copy, so leaving the screen mid-tick
    // cannot set state on a gone component, and a second copy restarts the
    // second rather than inheriting what was left of the first.
    return () => clearTimeout(id);
  }, [copied]);

  const screenColor = colord(color).lighten(0.18).toHex();
  // A `const` rather than a boolean flag so it narrows `string | null` for both
  // the copy button and the renderer below.
  const scriptText = script?.trim() ? script : null;

  return (
    <>
      <Stack.Toolbar placement="right">
        {/* Reading and performing are the two things anyone does with a
            script, so the prompter sits next to copy rather than behind a
            menu. Same params as this screen was opened with — the prompter
            reads the deck itself, so nothing large travels in the route. */}
        <Stack.Toolbar.Button
          icon={"text.line.first.and.arrowtriangle.forward"}
          accessibilityLabel="Teleprompter"
          disabled={!scriptText}
          // `push`, not `navigate`: navigate would reuse an existing
          // prompter screen and only swap its params, leaving the previous
          // deck's scroll position and running clock in place.
          onPress={() =>
            router.push({
              pathname: "/(authenticated)/(script)/teleprompter",
              params: { script: deckId, color },
            })
          }
        />
        <Stack.Toolbar.Button
          icon={
            copied ? "checkmark" : "rectangle.portrait.on.rectangle.portrait"
          }
          accessibilityLabel={copied ? "Script copied" : "Copy script"}
          disabled={!scriptText}
          onPress={() => {
            if (!scriptText) return;
            Clipboard.setString(scriptText);
            haptics.success();
            setCopied(true);
          }}
        />
      </Stack.Toolbar>
      <ScrollView
        style={[styles.screen, { backgroundColor: screenColor }]}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {scriptText ? (
          // Same component and the same props the preview screen renders with,
          // so the markdown — bold stress, italic delivery notes, `> ` pause
          // blockquotes — lays out identically in both places.
          <ScriptText script={scriptText} fontSize={20} />
        ) : isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <Text style={styles.empty}>No script found.</Text>
        )}
      </ScrollView>
    </>
  );
};

export default ScriptTextScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  loading: { marginTop: 80 },
  empty: {
    fontFamily: fonts.amarna.regular,
    fontSize: 16,
    opacity: 0.4,
    textAlign: "center",
    marginTop: 80,
  },
});
