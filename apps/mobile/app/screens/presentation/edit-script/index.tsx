import { Keyboard, StyleSheet, TextInput } from "react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useDeckGeneration } from "@/hooks/use-deck-generation";
import { useColors } from "@/constants/theme";
import {
  KeyboardAvoidingView,
  KeyboardController,
} from "react-native-keyboard-controller";
import { useHeaderHeight } from "expo-router/build/react-navigation";

type EditScriptScreenParams = {
  deckId: string;
};

const HISTORY_DEBOUNCE_MS = 500;

const EditScriptScreen = () => {
  const { deckId } = useLocalSearchParams<EditScriptScreenParams>();
  const {
    deck,
    isEditing: saving,
    edit,
    fetchDeck,
  } = useDeckGeneration({ deckId });

  const [scriptValue, setScriptValue] = useState<string>("");
  const seededRef = useRef(false);

  // Defensive fetch in case the ws snapshot (sent on connect, since
  // script_ready is a non-active status) hasn't arrived yet.
  useEffect(() => {
    if (deckId) fetchDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // Seed the editable text once we actually have the script — only once,
  // so it doesn't clobber in-progress edits if `deck` updates again later.
  useEffect(() => {
    if (!seededRef.current && deck?.script) {
      setScriptValue(deck.script);
      historyRef.current = [deck.script];
      seededRef.current = true;
    }
  }, [deck?.script]);

  const historyRef = useRef<string[]>([""]);
  const pointerRef = useRef(0);
  const lastEditRef = useRef(0);
  const isUndoRedoRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = () => {
    setCanUndo(pointerRef.current > 0);
    setCanRedo(pointerRef.current < historyRef.current.length - 1);
  };

  const handleChangeText = useCallback((value: string) => {
    setScriptValue(value);

    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    const now = Date.now();
    const history = historyRef.current;
    const pointer = pointerRef.current;

    // Always copy — never mutate the array historyRef.current currently
    // points at, even when we're about to just replace its last entry.
    const base =
      pointer < history.length - 1
        ? history.slice(0, pointer + 1)
        : history.slice();

    if (now - lastEditRef.current < HISTORY_DEBOUNCE_MS) {
      base[base.length - 1] = value;
      // eslint-disable-next-line react-hooks/immutability
      historyRef.current = base;
    } else {
      historyRef.current = [...base, value];
      pointerRef.current = historyRef.current.length - 1;
    }

    lastEditRef.current = now;
    syncFlags();
  }, []);

  const handleUndo = useCallback(() => {
    if (pointerRef.current <= 0) return;
    pointerRef.current -= 1;
    isUndoRedoRef.current = true;
    setScriptValue(historyRef.current[pointerRef.current]);
    lastEditRef.current = 0;
    syncFlags();
  }, []);

  const handleRedo = useCallback(() => {
    if (pointerRef.current >= historyRef.current.length - 1) return;
    pointerRef.current += 1;
    isUndoRedoRef.current = true;
    setScriptValue(historyRef.current[pointerRef.current]);
    lastEditRef.current = 0;
    syncFlags();
  }, []);

  const handleConfirm = async () => {
    if (saving) return;
    try {
      await edit(scriptValue);
      KeyboardController.dismiss();
      Keyboard.dismiss();
      router.dismiss();
    } catch {
      // surface a toast/snackbar here in your existing error pattern
    }
  };

  const { colors } = useColors();
  const headerHeight = useHeaderHeight();

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={"arrow.uturn.backward"}
          onPress={handleUndo}
          disabled={!canUndo}
        />
        <Stack.Toolbar.Button
          icon={"arrow.uturn.forward"}
          onPress={handleRedo}
          disabled={!canRedo}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"checkmark"}
          variant="prominent"
          tintColor={colors.rust}
          onPress={handleConfirm}
          disabled={saving}
        />
      </Stack.Toolbar>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
        <TextInput
          style={styles.input}
          value={scriptValue}
          autoCapitalize="none"
          autoComplete="off"
          onChangeText={handleChangeText}
          multiline
          textBreakStrategy="simple"
        />
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 30 },
  input: { flex: 1, fontSize: 20, textAlignVertical: "top" },
});

export default EditScriptScreen;
