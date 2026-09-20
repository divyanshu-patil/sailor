import { Stack } from "expo-router";

const Layout = () => {
  return (
    <Stack screenOptions={{ title: "Script" }}>
      <Stack.Screen
        name="create-new-script"
        options={{
          // headerLargeTitleEnabled: false,
          headerShown: false,
          title: "New Script",
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
          title: "All Scripts",
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
          title: "Practice",
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
          title: "Results",
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
          title: "Preview",
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
          title: "Script",
          headerShown: false,
          presentation: "modal",
        }}
      />
    </Stack>
  );
};

export default Layout;
