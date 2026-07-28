import { AppState, AppStateStatus } from "react-native";
import { scriptService } from "@/services/script.service";

/**
 * Decides when an in-flight script generation actually dies.
 *
 * The preview screen used to cancel on unmount, which meant a mistap on the back
 * gesture threw away a script the user had been waiting a minute for. Unmounting
 * is now silent — backing out to the wizard leaves the job running and coming
 * forward again re-attaches to it. What replaces the unmount cancel:
 *
 *  - landing on the home screen (the user left the creation flow deliberately),
 *  - the app going to the background (the closest signal to a quit React Native
 *    gives — `AppState` never reports a termination),
 *  - and, for anything neither of those catches, a server-side sweep that
 *    terminates generations whose client has stopped polling.
 *
 * Kept as a module rather than a store because the AppState subscription has to
 * outlive every screen that reads it, and because a cancel triggered from
 * navigation must not depend on a React tree that's mid-transition.
 */

interface ActiveGeneration {
  id: string;
  /** False once the job reaches a terminal state. A completed script must never
   *  be cancelled by a later background — cancel is only ever about work still
   *  being paid for. */
  running: boolean;
}

let active: ActiveGeneration | null = null;
let appStateSubscription: { remove: () => void } | null = null;

/** Called when a generation starts or is resumed. */
export function registerActiveGeneration(id: string): void {
  active = { id, running: true };
}

/** Called when the job reaches a terminal state, or when its script is accepted
 *  — after which there is nothing left to cancel. */
export function releaseActiveGeneration(id?: string): void {
  if (id && active?.id !== id) return;
  active = null;
}

export function getActiveGenerationId(): string | null {
  return active?.running ? active.id : null;
}

/**
 * Cancel whatever is running, if anything.
 *
 * Best-effort and deliberately un-awaited by most callers: this fires from
 * navigation and lifecycle transitions, where blocking on a round trip would
 * stall the UI. A cancel that fails to reach the server is caught by the
 * server-side stale sweep instead.
 */
export async function cancelActiveGeneration(reason: string): Promise<void> {
  const current = active;
  if (!current?.running) return;

  // Cleared before the request, not after: two triggers can fire in the same
  // tick (backgrounding while navigating home), and without this both would
  // send a cancel for the same job.
  active = null;

  try {
    await scriptService.cancel(current.id);
  } catch {
    // Nothing useful to show the user — they've already left the screen. The
    // generation's own status is the source of truth when they come back.
    console.log(`[generation-guard] cancel failed (${reason})`, current.id);
  }
}

/**
 * Start listening for the app being backgrounded. Idempotent, and returns an
 * unsubscribe — mount it once, at the authenticated layout.
 */
export function startGenerationLifecycleWatch(): () => void {
  if (appStateSubscription) return () => {};

  const handleChange = (state: AppStateStatus) => {
    // "inactive" is not a departure — iOS reports it for a notification banner,
    // the app switcher preview, and a Face ID prompt. Cancelling there would
    // kill a generation because a text message arrived.
    if (state === "background") {
      void cancelActiveGeneration("app backgrounded");
    }
  };

  const subscription = AppState.addEventListener("change", handleChange);
  appStateSubscription = subscription;

  return () => {
    subscription.remove();
    appStateSubscription = null;
  };
}
