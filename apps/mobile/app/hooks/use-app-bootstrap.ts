import { useEffect, useState } from "react";
import * as Font from "expo-font";

import { preloadMascots } from "@/screens/daily-practice/components/Mascot";

/**
 * The longest the splash screen may stay up waiting for assets.
 *
 * A backstop, not a budget. Everything below is local work that finishes in
 * well under this, but a prefetch that never settles must not be able to hold
 * the app on the splash forever — that is the same failure as the blank launch,
 * wearing a nicer picture.
 */
const MAX_WAIT_MS = 4000;

/**
 * Faces the home screen draws with that are NOT embedded in the binary.
 *
 * app.json embeds AlanSans 400Regular and Kalam 400Regular and nothing else, so
 * every heavier AlanSans weight and the light Kalam the handwritten notes use
 * have to be loaded at runtime. Loading them before the splash comes down is
 * what stops the home screen drawing its greeting and streak in San Francisco
 * for the first frames and then reflowing.
 */
const HOME_FONTS = {
  "AlanSans-Light": require("@expo-google-fonts/alan-sans/300Light/AlanSans_300Light.ttf"),
  "AlanSans-Regular": require("@expo-google-fonts/alan-sans/400Regular/AlanSans_400Regular.ttf"),
  "AlanSans-Medium": require("@expo-google-fonts/alan-sans/500Medium/AlanSans_500Medium.ttf"),
  "AlanSans-SemiBold": require("@expo-google-fonts/alan-sans/600SemiBold/AlanSans_600SemiBold.ttf"),
  "AlanSans-Bold": require("@expo-google-fonts/alan-sans/700Bold/AlanSans_700Bold.ttf"),
  "AlanSans-ExtraBold": require("@expo-google-fonts/alan-sans/800ExtraBold/AlanSans_800ExtraBold.ttf"),
  "AlanSans-Black": require("@expo-google-fonts/alan-sans/900Black/AlanSans_900Black.ttf"),
  "Kalam-Light": require("@expo-google-fonts/kalam/300Light/Kalam_300Light.ttf"),
  "Kalam-Regular": require("@expo-google-fonts/kalam/400Regular/Kalam_400Regular.ttf"),
};

/**
 * The work that has to finish before the splash screen comes down.
 *
 * Only what the first screen actually needs: the fonts it sets type in, and the
 * mascot images. Both used to be fire-and-forget, so the app appeared and then
 * visibly changed under the person — type reflowing as faces landed, characters
 * popping into empty states a beat after the words around them. Holding the
 * splash for them costs nothing the app was not already spending; it just
 * spends it behind the picture instead of in front of the person.
 *
 * Amarna and Newsreader are deliberately NOT here. Nothing on the home screen
 * uses them — they belong to the script and daily-practice screens, which are
 * several taps away and have their own time to load.
 *
 * Never rejects: a font or an image that fails to load is not a reason to
 * withhold the app.
 */
export function useAppBootstrap(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setReady(true);
    };

    const timeout = setTimeout(finish, MAX_WAIT_MS);

    Promise.allSettled([Font.loadAsync(HOME_FONTS), preloadMascots()]).then(
      () => {
        clearTimeout(timeout);
        finish();
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return ready;
}
