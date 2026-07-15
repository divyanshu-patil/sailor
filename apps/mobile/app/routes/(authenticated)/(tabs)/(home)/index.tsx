import { ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import React, { useState } from "react";
import { Stack, useRouter } from "expo-router";
import HomeScreen from "@/screens/home/home";
import apiClient from "@/lib/api/client";

const Home = () => {
  const router = useRouter();

  // TEMP: Health check button
  const [checking, setChecking] = useState(false);
  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await apiClient.get<{ status: string; service: string }>(
        "/health",
      );
      Alert.alert("Backend OK", `${res.data.status} — ${res.data.service}`);
    } catch (e: any) {
      Alert.alert("Backend Unreachable", e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="prominent"
          tintColor={"#c11b5c"}
          // icon={"plus"}
          onPress={() =>
            router.push("/(authenticated)/(script)/create-new-script", {
              withAnchor: true,
            })
          }
        >
          New Script
        </Stack.Toolbar.Button>
        {/*  TEMP: Health check button */}
        <Stack.Toolbar.Button
          variant="prominent"
          tintColor={checking ? "#888" : "#1bc15e"}
          onPress={checkHealth}
        >
          {checking ? "Checking..." : "Health"}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <HomeScreen />
    </>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {},
});
