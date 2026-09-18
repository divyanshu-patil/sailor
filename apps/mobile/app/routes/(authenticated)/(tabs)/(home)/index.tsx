import { Alert } from "react-native";
import React, { useCallback, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import HomeScreen from "@/screens/home/home";
import apiClient from "@/lib/api/client";
import { cancelActiveGeneration } from "@/lib/generation-guard";

const Home = () => {
  const router = useRouter();

  /**
   * Landing here is what ends an in-flight script generation.
   *
   * Backing out of the preview screen no longer cancels anything — that gesture
   * is too easy to hit by accident, and losing a minute of generation to it was
   * the problem. Reaching home is unambiguous: the user left the creation flow,
   * so the job stops. A no-op when nothing is running.
   */
  useFocusEffect(
    useCallback(() => {
      void cancelActiveGeneration("navigated home");
    }, []),
  );

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
        {/*  TEMP: mascot state machine harness */}
        <Stack.Toolbar.Button
          variant="prominent"
          tintColor={"#B75C5C"}
          onPress={() =>
            router.push("/(authenticated)/(tabs)/(home)/mascot-lab")
          }
        >
          Mascot
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

