import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useFonts } from "expo-font";
import { KronaOne_400Regular } from "@expo-google-fonts/krona-one/400Regular";
import {
  AlanSans_300Light,
  AlanSans_400Regular,
  AlanSans_500Medium,
  AlanSans_600SemiBold,
  AlanSans_700Bold,
  AlanSans_800ExtraBold,
  AlanSans_900Black,
} from "@expo-google-fonts/alan-sans";
import {
  Amarna_100Thin,
  Amarna_100Thin_Italic,
  Amarna_200ExtraLight,
  Amarna_200ExtraLight_Italic,
  Amarna_300Light,
  Amarna_300Light_Italic,
  Amarna_400Regular,
  Amarna_400Regular_Italic,
  Amarna_500Medium,
  Amarna_500Medium_Italic,
  Amarna_600SemiBold,
  Amarna_600SemiBold_Italic,
  Amarna_700Bold,
  Amarna_700Bold_Italic,
} from "@expo-google-fonts/amarna";

import {
  Newsreader_200ExtraLight,
  Newsreader_300Light,
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
  Newsreader_800ExtraBold,
  Newsreader_200ExtraLight_Italic,
  Newsreader_300Light_Italic,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium_Italic,
  Newsreader_600SemiBold_Italic,
  Newsreader_700Bold_Italic,
  Newsreader_800ExtraBold_Italic,
} from "@expo-google-fonts/newsreader";
import { useOnboardingStore } from "@/store/onboarding.store";
import { useProfileSetupStore } from "@/store/profile-setup.store";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useAppUserStore } from "@/store/app-user.store";

export default function Index() {
  const router = useRouter();
  // const isAuthenticated = useAppUserStore((s) => s.isAuthenticated);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
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
  const { isSignedIn, isLoaded, userId } = useAuth();
  const hasNavigated = useRef(false);

  const hasCompletedOnboarding =
    !!userId && onboardingCompletedForUserId === userId;
  const hasCompletedProfileSetup =
    !!userId && profileSetupCompletedForUserId === userId;

  const [fontsLoaded] = useFonts({
    KronaOne: KronaOne_400Regular,
    "AlanSans-Light": AlanSans_300Light,
    "AlanSans-Regular": AlanSans_400Regular,
    "AlanSans-Medium": AlanSans_500Medium,
    "AlanSans-SemiBold": AlanSans_600SemiBold,
    "AlanSans-Bold": AlanSans_700Bold,
    "AlanSans-ExtraBold": AlanSans_800ExtraBold,
    "AlanSans-Black": AlanSans_900Black,

    Amarna: Amarna_400Regular,
    "Amarna-Italic": Amarna_400Regular_Italic,
    "Amarna-Thin": Amarna_100Thin,
    "Amarna-ThinItalic": Amarna_100Thin_Italic,
    "Amarna-ExtraLight": Amarna_200ExtraLight,
    "Amarna-ExtraLightItalic": Amarna_200ExtraLight_Italic,
    "Amarna-Light": Amarna_300Light,
    "Amarna-LightItalic": Amarna_300Light_Italic,
    "Amarna-Medium": Amarna_500Medium,
    "Amarna-MediumItalic": Amarna_500Medium_Italic,
    "Amarna-SemiBold": Amarna_600SemiBold,
    "Amarna-SemiBoldItalic": Amarna_600SemiBold_Italic,
    "Amarna-Bold": Amarna_700Bold,
    "Amarna-BoldItalic": Amarna_700Bold_Italic,

    Newsreader: Newsreader_400Regular,
    "Newsreader-Italic": Newsreader_400Regular_Italic,

    "Newsreader-ExtraLight": Newsreader_200ExtraLight,
    "Newsreader-ExtraLightItalic": Newsreader_200ExtraLight_Italic,

    "Newsreader-Light": Newsreader_300Light,
    "Newsreader-LightItalic": Newsreader_300Light_Italic,

    "Newsreader-Medium": Newsreader_500Medium,
    "Newsreader-MediumItalic": Newsreader_500Medium_Italic,

    "Newsreader-SemiBold": Newsreader_600SemiBold,
    "Newsreader-SemiBoldItalic": Newsreader_600SemiBold_Italic,

    "Newsreader-Bold": Newsreader_700Bold,
    "Newsreader-BoldItalic": Newsreader_700Bold_Italic,

    "Newsreader-ExtraBold": Newsreader_800ExtraBold,
    "Newsreader-ExtraBoldItalic": Newsreader_800ExtraBold_Italic,
  });

  useEffect(() => {
    if (
      !fontsLoaded ||
      !isHydrated ||
      !isProfileSetupHydrated ||
      !isOnboardingCompletionHydrated ||
      !isLoaded
    ) {
      return;
    }
    if (hasNavigated.current) return;

    hasNavigated.current = true;

    if (!hasSeenOnboarding) {
      router.replace("/(onboarding)/welcome");
    } else if (isSignedIn) {
      // Verified. Onboarding runs first, then the optional profile wizard.
      if (!hasCompletedOnboarding) {
        router.replace("/(onboarding-setup)" as Href);
      } else if (!hasCompletedProfileSetup) {
        router.replace("/(profile-setup)" as Href);
      } else {
        router.replace("/(authenticated)");
      }
    } else {
      router.replace("/(unauthenticated)");
    }
  }, [
    isHydrated,
    isProfileSetupHydrated,
    isOnboardingCompletionHydrated,
    isSignedIn,
    isLoaded,
    userId,
    hasSeenOnboarding,
    hasCompletedOnboarding,
    hasCompletedProfileSetup,
    fontsLoaded,
    router,
  ]);

  if (!isHydrated || !isProfileSetupHydrated || !isOnboardingCompletionHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}
