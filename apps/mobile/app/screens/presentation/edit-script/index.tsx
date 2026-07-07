import { StyleSheet, TextInput } from "react-native";
import React, { useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";

type EditScriptScreenParams = {
  script: string;
};

const EditScriptScreen = () => {
  const { script } = useLocalSearchParams<EditScriptScreenParams>();
  const [scriptValue, setScriptValue] = useState<string>(script);

  const handleConfirm = () => {
    router.dismiss();
  };
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"checkmark"}
          variant="prominent"
          onPress={handleConfirm}
        />
      </Stack.Toolbar>

      <TextInput value={scriptValue} onChangeText={setScriptValue} multiline />
    </>
  );
};

export default EditScriptScreen;

const styles = StyleSheet.create({});
