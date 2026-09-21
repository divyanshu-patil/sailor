import { useEffect, useState } from "react";
import { useAuth } from "@clerk/expo";

import { useAppUserStore } from "@/store/app-user.store";

/**
 * How long to wait for Clerk before starting the app from what is on disk.
 *
 * Clerk resolves its session against its servers, and with no connection
 * `isLoaded` can stay false indefinitely — which is what left the app on a
 * blank white screen offline, because both the root layout and the index route
 * refused to render anything until it flipped.
 *
 * Long enough that a healthy cold start never sees the fallback (Clerk settles
 * in a few hundred ms online), short enough that an offline launch is not a
 * wait.
 */
const CLERK_GRACE_MS = 2500;

export interface AuthGate {
  /** Safe to route on. True once Clerk has answered, or once the grace period
   *  has passed and the persisted session is standing in for it. */
  ready: boolean;
  isSignedIn: boolean;
  userId: string | null;
  /** The answer came from disk rather than from Clerk. */
  fromCache: boolean;
}

/**
 * Whether the app knows who is signed in — from Clerk, or from disk.
 *
 * One hook rather than the same `isLoaded` check in two places: the root layout
 * and the index route both gate on this, and they have to agree or the app
 * routes itself somewhere the layout will not render.
 *
 * The cached answer is `appUser.clerkUserId`, which the store already persists
 * for every signed-in user, so no new state is written to make this work. It is
 * only ever used to decide WHICH screen to show; every request still carries a
 * real Clerk token, so a stale cache cannot get anyone into an account.
 */
export function useAuthGate(): AuthGate {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const cachedUserId = useAppUserStore((s) => s.appUser?.clerkUserId ?? null);
  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => setGraceExpired(true), CLERK_GRACE_MS);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  if (isLoaded) {
    return {
      ready: true,
      isSignedIn: !!isSignedIn,
      userId: userId ?? null,
      fromCache: false,
    };
  }

  if (graceExpired) {
    // No cached user means nobody has signed in on this device, so the
    // unauthenticated flow is the correct offline destination — not a guess.
    return {
      ready: true,
      isSignedIn: cachedUserId !== null,
      userId: cachedUserId,
      fromCache: true,
    };
  }

  return { ready: false, isSignedIn: false, userId: null, fromCache: false };
}
