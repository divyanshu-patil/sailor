import ScriptDetailScreen from "@/screens/presentation/script-detail";
import { router, Stack } from "expo-router";

const ScriptDetail = () => {
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={"chevron.backward"}
          onPress={() => router.back()}
        ></Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScriptDetailScreen />
    </>
  );
};

export default ScriptDetail;
