import React, { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";
import { router, type Href } from "expo-router";
import { useAuth } from "@clerk/expo";

import ProfilePictureStep from "./components/profile-picture-step";
import { userService } from "@/services/user.service";
import { useProfileSetupStore } from "@/store/profile-setup.store";

/**
 * The optional, post-onboarding setup wizard.
 *
 * It owns the single completion boundary for the whole wizard, so adding a
 * future step (preferences, theme, …) means inserting a screen before
 * `finish` rather than touching routing. Reaching this screen already implies
 * the user is verified and has finished onboarding — see the root layout's
 * guards.
 */
const OptionalProfileWizard = () => {
  const { userId } = useAuth();
  const completeProfileSetup = useProfileSetupStore(
    (s) => s.completeProfileSetup,
  );

  // Both "saved a photo" and "skipped" land here. Completion is recorded
  // against the Clerk user, which flips the root stack from this group to the
  // authenticated app; the explicit replace just makes that transition
  // immediate.
  const finish = useCallback(() => {
    if (!userId) return;
    completeProfileSetup(userId);
    // Same shape as onboarding's: the local flag drives the navigation, the
    // server copy is what a reinstall reads back.
    void userService
      .updateProfile({ profile_setup_completed: true })
      .catch(() => {});
    router.replace("/(authenticated)" as Href);
  }, [userId, completeProfileSetup]);

  // The wizard is optional, so an Android back press should mean "skip", not
  // drop the user out of the app from the first screen of the stack.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        finish();
        return true;
      },
    );
    return () => subscription.remove();
  }, [finish]);

  return <ProfilePictureStep onComplete={finish} onSkip={finish} />;
};

export default OptionalProfileWizard;
