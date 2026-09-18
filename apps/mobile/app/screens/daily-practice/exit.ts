import { router } from "expo-router";

import { haptics } from "@/lib/haptics";

/** Where the flow came from — home is the only screen that links into it. */
const HOME = "/(authenticated)/(tabs)/(home)" as const;

/**
 * Leave daily practice for home, however the flow was entered.
 *
 * `dismissAll()` only unwinds to the root of the *closest* stack, which is the
 * daily-practice stack itself — so "Done" landed back on the intro, and a
 * widget cold-launch (`sailor://daily-practice`, no history at all) left the
 * user stranded with nothing to pop. `dismissTo` pops back to home when it is
 * in the history, and replaces the current screen with it when it isn't, so the
 * one call covers both entries and still animates like a real back.
 */
export function exitToHome(): void {
  haptics.back();
  router.dismissTo(HOME);
}
