import { StyleSheet, TextInput } from "react-native";
import React, { useCallback, useRef, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useScriptStore } from "@/store/script-store";
import { scriptService } from "@/services/script.debug.service";
import { useColors } from "@/constants/theme";
import {
  KeyboardAvoidingView,
  KeyboardController,
} from "react-native-keyboard-controller";
import { useHeaderHeight } from "expo-router/build/react-navigation";

type EditScriptScreenParams = {
  jobId: string;
};

const HISTORY_DEBOUNCE_MS = 500;

const EditScriptScreen = () => {
  const { jobId } = useLocalSearchParams<EditScriptScreenParams>();
  const { script, setResult } = useScriptStore();
  const [scriptValue, setScriptValue] = useState<string>(script);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const updated = await scriptService.edit(jobId, scriptValue);
      setResult(updated);
      KeyboardController.dismiss();
      router.dismiss();
    } catch {
      // surface a toast/snackbar here in your existing error pattern
    } finally {
      setSaving(false);
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
  input: {
    flex: 1, // <-- fill the container
    fontSize: 20,
    textAlignVertical: "top", // Android: align text to top, not center
  },
});

export default EditScriptScreen;
