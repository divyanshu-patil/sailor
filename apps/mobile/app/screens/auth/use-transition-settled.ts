import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";

// Safety net: `transitionEnd` does not fire if the screen is presented without
// an animation, and a mascot scene that never mounts is worse than one that
// mounts a beat early. Comfortably longer than the default push.
const FALLBACK_MS = 500;

/**
 * False until this screen's push animation has finished.
 *
 * Mounting a Lottie mascot inflates its `.lottie` on the native main thread —
 * the login hero alone is ~800KB, and the screen mounts five of them — which
 * lands squarely on top of the push animation and drops its frames. Preloading
 * the files only removes the fetch; the inflate is the expensive half, so the
 * scene has to wait for the transition rather than race it.
 */
export function useTransitionSettled() {
  const navigation = useNavigation();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener(
      // Typed on the native stack's event map, which `useNavigation()` widens
      // away here; the listener is a no-op on any navigator without it.
      "transitionEnd" as never,
      (() => setSettled(true)) as never,
    );
    const fallback = setTimeout(() => setSettled(true), FALLBACK_MS);

    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigation]);

  return settled;
}
