import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import React from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { colord } from "colord";
import Clipboard from "@react-native-clipboard/clipboard";
import { fonts } from "@/constants/fonts";
import { useDeck } from "@/hooks";
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

  const screenColor = colord(color).lighten(0.18).toHex();
  // A `const` rather than a boolean flag so it narrows `string | null` for both
  // the copy button and the renderer below.
  const scriptText = script?.trim() ? script : null;

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"rectangle.portrait.on.rectangle.portrait"}
          disabled={!scriptText}
          onPress={() => scriptText && Clipboard.setString(scriptText)}
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
