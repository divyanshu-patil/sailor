import { StyleSheet } from "react-native";
import React from "react";
import { router, Stack } from "expo-router";
import CreateNewScriptScreen from "@/screens/presentation/new-script";

const CreateNewScript = () => {
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={"chevron.backward"}
          onPress={() => router.back()}
        ></Stack.Toolbar.Button>
      </Stack.Toolbar>
      <CreateNewScriptScreen />
    </>
  );
};

export default CreateNewScript;

const styles = StyleSheet.create({});
