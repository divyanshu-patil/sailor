import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";

import { useProIntroStore } from "@/store/pro-intro.store";
import { useIsPro, useSubscriptionStore } from "@/store/subscription.store";
import { ENV } from "@/lib/config/env";

/** How long a sign-in may wait on RevenueCat before the screen decides anyway. */
const ENTITLEMENT_WAIT_MS = 3000;

/**
 * The way into the app. Straight home — except right after an account finishes
 * onboarding, when someone without Pro sees what it includes first.
 */
const Home = () => {
  const owed = useProIntroStore((s) => s.pending);
  const isPro = useIsPro();
  const { userId } = useAuth();
  // Right after signing up the entitlement in hand can still be the previous
  // customer's — the anonymous one, or whoever signed out — until RevenueCat's
  // logIn lands. Deciding on that skipped the screen for a new account on any
  // device whose store account had bought Pro before.
  const answeredFor = useSubscriptionStore((s) => s.loggedInAs);
  const [gaveUp, setGaveUp] = useState(false);
  const waiting = owed && answeredFor !== userId && !gaveUp;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setGaveUp(true), ENTITLEMENT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (waiting) return null;
  // With billing off everyone is Pro, but the screen is still shown.
  if (owed && (!isPro || !ENV.REVENUECAT_ENABLED)) {
    return <Redirect href="/(authenticated)/sailors-pro" />;
  }
  return <Redirect href={"/(authenticated)/(tabs)/(home)"} />;
};

export default Home;
