import { Keyboard, StyleSheet, Text, TextInput } from "react-native";
import React, { useCallback, useRef, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useScriptStore } from "@/store/script-store";
import { useScriptGeneration } from "../hooks/use-script-generation";
import { useColors } from "@/constants/theme";
import {
  KeyboardAvoidingView,
  KeyboardController,
} from "react-native-keyboard-controller";
import { useHeaderHeight } from "expo-router/build/react-navigation";

type EditScriptScreenParams = {
  generationId: string;
};

const HISTORY_DEBOUNCE_MS = 500;

const EditScriptScreen = () => {
  const { generationId } = useLocalSearchParams<EditScriptScreenParams>();
  const script = useScriptStore((s) => s.script);
  const setResult = useScriptStore((s) => s.setResult);
  const [scriptValue, setScriptValue] = useState<string>(script);

  // The local undo stack below is per-keystroke, for this editing session only.
  // It's distinct from the script's *version* history — which spans generations,
  // AI revisions and saved edits, and lives on the preview screen's toolbar. A
  // save appends to that one; the stack here is discarded when the modal closes.
  //
  // No `attach` here on purpose. This screen has nothing to poll — the script is
  // already written and the save is a plain PATCH — but attaching started a full
  // polling lifecycle, and because `attach`'s identity changed every render the
  // effect that called it re-fired on every render: attach -> poll -> "completed"
  // -> setState -> render -> new attach -> attach again, one GET /status per
  // round trip for as long as the modal stayed open. The generation id goes
  // straight to `edit` instead.
  const { edit, isRevising: saving, error: saveError } = useScriptGeneration();

  // undo/redo history
  const historyRef = useRef<string[]>([script]);
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

    // if this change came from undo/redo itself, don't re-record it
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    const now = Date.now();
    const history = historyRef.current;
    const pointer = pointerRef.current;

    // if we're not at the tip (user typed after undoing), drop the redo branch
    const truncated =
      pointer < history.length - 1 ? history.slice(0, pointer + 1) : history;

    if (now - lastEditRef.current < HISTORY_DEBOUNCE_MS) {
      // still within the same "burst" of typing — replace current tip
      truncated[truncated.length - 1] = value;
      historyRef.current = truncated;
    } else {
      // new burst — push a new history entry
      historyRef.current = [...truncated, value];
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
    lastEditRef.current = 0; // force next real edit to start a new burst
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
      const updated = await edit(scriptValue, generationId);
      if (updated) {
        setResult({
          generationId: updated.id,
          title: updated.title,
          script: updated.script,
        });
        KeyboardController.dismiss();
        Keyboard.dismiss();

        router.dismiss();
      }
      // A failed save leaves the modal open with the user's text intact and
      // `saveError` rendered below — dismissing here would throw the edit away.
    } catch {
      // `edit` already captured the reason into `saveError`.
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
      {/* <KeyboardAvoidingView> */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
        {!!saveError && <Text style={styles.error}>{saveError}</Text>}
        <TextInput
          style={styles.input}
          value={scriptValue}
          // scrollEnabled={false}
          autoCapitalize="none"
          autoComplete="off"
          onChangeText={handleChangeText}
          multiline
          textBreakStrategy="simple"
        />
      </KeyboardAvoidingView>
      {/* </KeyboardAvoidingView> */}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, // <-- was missing; lets TextInput own its scroll region
    paddingHorizontal: 30,
  },
  error: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C0392B",
    paddingBottom: 12,
  },
  input: {
    flex: 1, // <-- fill the container
    fontSize: 20,
    textAlignVertical: "top", // Android: align text to top, not center
  },
});

export default EditScriptScreen;
