import React from "react";
import { Stack } from "expo-router";

const ModalLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Header shown, unlike its sibling: the Publish action lives in the
          sheet's toolbar, and a hidden header has nowhere to put it. */}
      <Stack.Screen
        name="publish"
        options={{
          headerShown: true,
          headerTitle: "Publish",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="edit-script"
        options={{
          headerShown: false,
          headerTitle: "",
          headerTransparent: true,
        }}
      />
    </Stack>
  );
};

export default ModalLayout;
