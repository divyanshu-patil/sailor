import { useEffect, useRef } from "react";
import { useRouter, type Href } from "expo-router";
import { useFonts } from "expo-font";
import { Amarna_400Regular, Amarna_700Bold } from "@expo-google-fonts/amarna";

import {
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold_Italic,
} from "@expo-google-fonts/newsreader";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useProfileSetupStore } from "@/store/profile-setup.store";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useAppUserStore } from "@/store/app-user.store";

export default function Index() {
  const router = useRouter();
  // const isAuthenticated = useAppUserStore((s) => s.isAuthenticated);
  const isHydrated = useAppUserStore((s) => s._hasHydrated);
  const isProfileSetupHydrated = useProfileSetupStore((s) => s._hasHydrated);
  const profileSetupCompletedForUserId = useProfileSetupStore(
    (s) => s.completedForUserId,
  );
  const isOnboardingCompletionHydrated = useOnboardingCompletionStore(
    (s) => s._hasHydrated,
  );
  const onboardingCompletedForUserId = useOnboardingCompletionStore(
    (s) => s.completedForUserId,
  );
  // const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { ready: authReady, isSignedIn, userId } = useAuthGate();
  const hasNavigated = useRef(false);

  const hasCompletedOnboarding =
    !!userId && onboardingCompletedForUserId === userId;
  const hasCompletedProfileSetup =
    !!userId && profileSetupCompletedForUserId === userId;

  // Only the faces the app actually names in constants/fonts.ts. The full
  // Amarna and Newsreader families were being parsed here — about thirty-five
  // faces — and nothing referenced most of them. `useFonts` no longer gates
  // navigation either (see the effect below), so this is background work now.
  // Amarna and Newsreader only — the script and daily-practice families.
  // Deliberately NOT blocking: nothing on the first screen sets type in them,
  // and they are several taps away. The home screen's own faces are loaded
  // before the splash comes down instead (useAppBootstrap).
  useFonts({
    Amarna: Amarna_400Regular,
    "Amarna-Bold": Amarna_700Bold,

    Newsreader: Newsreader_400Regular,
    "Newsreader-Italic": Newsreader_400Regular_Italic,
    "Newsreader-Medium": Newsreader_500Medium,
    "Newsreader-MediumItalic": Newsreader_500Medium_Italic,
    "Newsreader-SemiBold": Newsreader_600SemiBold,
    "Newsreader-SemiBoldItalic": Newsreader_600SemiBold_Italic,
  });

  useEffect(() => {
    // Deliberately not waiting on fonts. Text renders in the system face for a
    // frame and swaps when they land, which nobody notices — whereas holding
    // the first navigation until every face has parsed is dead time on every
    // single launch.
    if (
      !isHydrated ||
      !isProfileSetupHydrated ||
      !isOnboardingCompletionHydrated ||
      !authReady
    ) {
      return;
    }
    if (hasNavigated.current) return;

    hasNavigated.current = true;

    if (isSignedIn) {
      // Verified. Onboarding runs first, then the optional profile wizard.
      if (!hasCompletedOnboarding) {
        router.replace("/(onboarding-setup)" as Href);
      } else if (!hasCompletedProfileSetup) {
        router.replace("/(profile-setup)" as Href);
      } else {
        router.replace("/(authenticated)");
      }
    } else {
      // The base screen is the app's front door — always, whether or not the
      // intro has been seen. It hands off to onboarding / create-account.
      router.replace("/(unauthenticated)");
    }
  }, [
    isHydrated,
    isProfileSetupHydrated,
    isOnboardingCompletionHydrated,
    isSignedIn,
    authReady,
    userId,
    hasCompletedOnboarding,
    hasCompletedProfileSetup,
    router,
  ]);

  // Always null: the root layout holds the splash screen up until everything
  // is ready, so anything drawn here is a flash of something else on top of it.
  return null;
}
