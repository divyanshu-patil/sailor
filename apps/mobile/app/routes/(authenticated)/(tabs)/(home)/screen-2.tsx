import { View, Text, ScrollView } from "react-native";
import React, { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useNavigation } from "expo-router";

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
        ></Stack.Toolbar.Button>
      </Stack.Toolbar>
    </ScrollView>
  );
};

export default Screen2;
