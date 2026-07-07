import { TextInput } from "react-native";
import React, { useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useScriptStore } from "@/store/script-store";
import { scriptService } from "@/services/script.debug.service";

type EditScriptScreenParams = {
  jobId: string;
};

const EditScriptScreen = () => {
  const { jobId } = useLocalSearchParams<EditScriptScreenParams>();
  const { script, setResult } = useScriptStore();
  const [scriptValue, setScriptValue] = useState<string>(script);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await scriptService.edit(jobId, scriptValue);
      setResult(updated);
      router.dismiss();
    } catch {
      // surface a toast/snackbar here in your existing error pattern
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {};
  const handleRedo = () => {};

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={"arrow.uturn.backward"}
          onPress={handleUndo}
          disabled={true}
        />
        <Stack.Toolbar.Button
          icon={"arrow.uturn.forward"}
          onPress={handleRedo}
          disabled={true}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"checkmark"}
          variant="prominent"
          onPress={handleConfirm}
          disabled={saving}
        />
      </Stack.Toolbar>

      <TextInput value={scriptValue} onChangeText={setScriptValue} multiline />
    </>
  );
};

export default EditScriptScreen;
