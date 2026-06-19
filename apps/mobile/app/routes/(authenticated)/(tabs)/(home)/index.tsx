import { ScrollView, StyleSheet, Text, View } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import HomeScreen from "@/screens/home/home";

const Home = () => {
  const router = useRouter();
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="prominent"
          tintColor={"#c11b5c"}
          onPress={() => router.push("./screen-2")}
        >
          Screen 2
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {/* <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
      > */}
      <HomeScreen />
      {/* </ScrollView> */}
    </>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {},
});
