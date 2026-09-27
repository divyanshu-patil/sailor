import { memo, useEffect } from "react";

import { preloadDotLottie } from "@/lib/dotlottie";

/**
 * Starts loading a set of mascots before the screens that show them mount.
 *
 * A cold mascot costs a fetch, an unzip and a Skottie parse, and without this
 * it pays them mid-push, on the screen you just opened, as an empty slot.
 * `lib/dotlottie` keeps every file it loads for the session, so a mascot
 * loaded here draws on its first frame wherever it later appears.
 *
 * Used by the auth flow, mounted under the splash for a signed-out launch and
 * for as long as the unauthenticated navigator lives.
 */
export default memo(function MascotPreloader({
  sources,
}: {
  /** Asset modules. Pass a module-level array so the effect runs once. */
  sources: readonly number[];
}) {
  useEffect(() => {
    preloadDotLottie(sources);
  }, [sources]);
  return null;
});
