import { Text, ScrollView } from "react-native";
import React, { useEffect } from "react";
import { router, Stack, useNavigation } from "expo-router";
import { Button, Host } from "@expo/ui/swift-ui";
import { buttonStyle } from "@expo/ui/swift-ui/modifiers";
const Screen2 = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const parent = navigation.getParent()?.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" } });
    return () => parent?.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Text>Screen2</Text>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="prominent"
          tintColor={"#c11b5c"}
          icon={"plus"}
          onPress={() =>
            router.push("/(authenticated)/(script)/create-new-script", {
              withAnchor: true,
            })
          }
        />
      </Stack.Toolbar>
      <Host matchContents>
        <Button
          label="Go to View All Script"
          modifiers={[buttonStyle("glassProminent")]}
          onPress={() =>
            router.navigate("/(authenticated)/(script)/view-all-script")
          }
        />
      </Host>
    </ScrollView>
  );
};

export default Screen2;
