import { Stack } from "expo-router";
import { defaultHeaderConfig } from "../(tabs)/header-constant";

const Layout = () => {
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="create-new-script"
        options={{
          // headerLargeTitleEnabled: false,
          headerShown: false,
          headerTitle: "",
          headerTitleStyle: {
            fontSize: 0,
          },
          // headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="view-all-script"
        options={{
          // headerLargeTitleEnabled: true,
          headerShown: true,
          headerTitle: "Script",
          // headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          // headerLargeTitleEnabled: true,
          headerShown: false,
          headerTitle: "Script",
          // headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="script"
        options={{
          // headerLargeTitleEnabled: true,
          headerShown: false,
          headerTitle: "Script",
          headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
        }}
      />
    </Stack>
  );
};

export default Layout;
