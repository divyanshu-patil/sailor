import { Stack } from "expo-router";

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
          headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          // headerLargeTitleEnabled: true,
          headerShown: false,
          headerTitle: "Script",
          headerBackButtonDisplayMode: "minimal",
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
      <Stack.Screen
        name="script-practice"
        options={{
          // headerLargeTitleEnabled: true,
          headerShown: true,
          headerTitle: "",
          headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="results"
        options={{
          // headerLargeTitleEnabled: true,
          headerShown: true,
          headerTitle: "",
          headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
          // animation: "fade",
          // presentation: "modal",
        }}
      />
      <Stack.Screen
        name="preview"
        options={{
          // headerLargeTitleEnabled: true,
          headerShown: true,
          headerTitle: "",
          headerBackButtonDisplayMode: "minimal",
          headerTransparent: true,
          // animation: "fade",
          // presentation: "modal",
        }}
      />
      <Stack.Screen
        name="modals"
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
    </Stack>
  );
};

export default Layout;
