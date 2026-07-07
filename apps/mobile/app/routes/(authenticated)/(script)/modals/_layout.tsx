import React from "react";
import { Stack } from "expo-router";

const ModalLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
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
