import React from "react";
import { Stack } from "expo-router";

const ModalLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="edit-script" options={{ presentation: "modal" }} />
    </Stack>
  );
};

export default ModalLayout;
