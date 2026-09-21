import React, { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import HomeScreen from "@/screens/home/home";
import { cancelActiveGeneration } from "@/lib/generation-guard";

const Home = () => {
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

  return <HomeScreen />;
};

export default Home;
