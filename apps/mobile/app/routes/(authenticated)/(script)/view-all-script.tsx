import { ScrollView } from "react-native";
import React from "react";
import AllScriptsScreen from "@/screens/presentation/view-all-scripts";
import { router, Stack } from "expo-router";

const ViewAllScript = () => {
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={"chevron.backward"}
          onPress={() => router.back()}
        ></Stack.Toolbar.Button>
      </Stack.Toolbar>
      <AllScriptsScreen />
    </>
  );
};

export default ViewAllScript;
