import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "@/store/auth-store";
import { useAuth } from "@clerk/expo";
import { useFonts } from "@expo-google-fonts/krona-one/useFonts";
import { KronaOne_400Regular } from "@expo-google-fonts/krona-one/400Regular";
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

export default function Index() {
  const router = useRouter();
  // const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { isSignedIn } = useAuth();
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding);
  const isHydrated = useAppStore((s) => s._hasHydrated);

  const [fontsLoaded] = useFonts({
    KronaOne: KronaOne_400Regular,

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
  });

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    if (!isHydrated) return;

    if (!hasSeenOnboarding) {
      router.replace("/(onboarding)/welcome");
    } else if (isSignedIn) {
      router.replace("/(authenticated)");
    } else {
      router.replace("/(unauthenticated)/login");
    }
  }, [isHydrated, isSignedIn, hasSeenOnboarding, fontsLoaded, router]);

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}
