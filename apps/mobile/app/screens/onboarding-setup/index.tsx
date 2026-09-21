import React, { useCallback, useEffect } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, type Href } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/ui/animated/PressableScale";
import { userService } from "@/services/user.service";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { PROFILE, profileFonts } from "@/screens/profile/theme";

/**
 * Temporary post-verification onboarding step.
 *
 * Placeholder by design: the real onboarding content is a separate feature, so
 * this screen exists only to hold the boundary between verification and the
 * optional profile setup wizard. It records completion per Clerk user and hands
 * off to `(profile-setup)`.
 */
const OnboardingSetupScreen = () => {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const completeOnboarding = useOnboardingCompletionStore(
    (s) => s.completeOnboarding,
  );

  const handleComplete = useCallback(() => {
    if (userId) completeOnboarding(userId);
    // Local first — the flag above is what moves the navigation, and it has to
    // work with no connection. The server copy is what survives a reinstall or
    // a second device; it is fire-and-forget because failing to record it is
    // not a reason to trap someone in onboarding.
    void userService
      .updateProfile({ onboarding_completed: true })
      .catch(() => {});
    router.replace("/(profile-setup)" as Href);
  }, [userId, completeOnboarding]);

  // Onboarding is mandatory, so a back press must not drop the user out of the
  // app from the first screen of the flow.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: Math.max(insets.bottom, 24) + 12,
          },
        ]}
      >
        <View style={styles.body}>
          <Text style={styles.eyebrow}>Step 1 of 2</Text>
          <Text style={styles.heading}>Welcome to Sailors</Text>
          <Text style={styles.subtitle}>
            This is a temporary onboarding screen. Tap below to finish
            onboarding and continue to profile setup.
          </Text>
        </View>

        <PressableScale
          onPress={handleComplete}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Complete onboarding"
        >
          <Text style={styles.buttonLabel}>Complete onboarding</Text>
        </PressableScale>
      </View>
    </View>
  );
};

export default OnboardingSetupScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PROFILE.background,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  eyebrow: {
    fontFamily: profileFonts.semibold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: PROFILE.muted,
  },
  heading: {
    marginTop: 12,
    fontFamily: profileFonts.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: PROFILE.ink,
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 320,
    fontFamily: profileFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: PROFILE.muted,
  },
  button: {
    height: 52,
    borderRadius: 999,
    backgroundColor: PROFILE.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontFamily: profileFonts.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: PROFILE.white,
  },
});
