import { useCallback, useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import Purchases, { type CustomerInfo } from "react-native-purchases";

import {
  PRO_ENTITLEMENT,
  configurePurchases,
  loginPurchases,
  logoutPurchases,
  presentCustomerCenter,
  presentPaywall,
  presentPaywallIfNeeded,
  isPurchasesSupported,
  openManageSubscriptions,
  requestRefund,
} from "@/lib/purchases";
import { useSubscriptionStore } from "@/store/subscription.store";

/**
 * Mount once, at the root, above every screen that can read entitlement.
 *
 * Three jobs, in order: configure the SDK, keep the store in sync with the one
 * customer-info listener the app is allowed to have, and follow Clerk's session
 * so a subscription belongs to a person rather than to a device.
 */
export function useRevenueCatBootstrap() {
  const { userId, isLoaded } = useAuth();
  const applyCustomerInfo = useSubscriptionStore((s) => s.applyCustomerInfo);
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!configurePurchases()) return;

    // One listener for the whole app. Every entitlement change lands here —
    // purchases, restores, renewals, expiries, and changes made on another
    // device — so no screen has to re-check on focus.
    const listener = (info: CustomerInfo) => applyCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);

    // Seed the first value: the listener only fires on *changes*, so without
    // this a subscriber sees the free state until their next renewal.
    void useSubscriptionStore.getState().refresh();

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo]);

  useEffect(() => {
    // Wait for Clerk: `userId` is null while the session is still loading, and
    // acting on that would log a signed-in user out of RevenueCat on every cold
    // start, orphaning their purchases behind an anonymous id.
    if (!isLoaded || !isPurchasesSupported) return;

    const previous = previousUserId.current;
    previousUserId.current = userId ?? null;
    if (previous === (userId ?? null)) return;

    void (async () => {
      // Clerk's user id is an opaque string, which is exactly what an app user
      // id should be — never an email or a raw database integer.
      const info = userId
        ? await loginPurchases(userId)
        : previous
          ? await logoutPurchases()
          : null;
      if (info) applyCustomerInfo(info);
    })();
  }, [userId, isLoaded, applyCustomerInfo]);
}

/**
 * What screens use.
 *
 * `requirePro` is the gate for an action: it returns true when the user may
 * proceed — either they already had Pro, or they just bought it on the paywall
 * that this call put in front of them.
 */
export function useSubscription() {
  const isPro = useSubscriptionStore((s) => s.isPro);
  const isReady = useSubscriptionStore((s) => s.isReady);
  const customerInfo = useSubscriptionStore((s) => s.customerInfo);
  const restore = useSubscriptionStore((s) => s.restore);
  const refresh = useSubscriptionStore((s) => s.refresh);

  const requirePro = useCallback(async () => {
    if (isPro) return true;
    const outcome = await presentPaywallIfNeeded();
    await refresh();
    return outcome === "purchased" || outcome === "restored";
  }, [isPro, refresh]);

  const openPaywall = useCallback(async () => {
    const outcome = await presentPaywall();
    await refresh();
    return outcome;
  }, [refresh]);

  const apply = useCallback(
    (info: CustomerInfo) => useSubscriptionStore.getState().applyCustomerInfo(info),
    [],
  );

  const openCustomerCenter = useCallback(
    () => presentCustomerCenter(apply),
    [apply],
  );

  /** The store's own subscription screen: cancel, switch plan, resubscribe. */
  const manageSubscription = useCallback(async () => {
    const opened = await openManageSubscriptions();
    if (!opened) {
      Alert.alert(
        "Not available",
        "Subscription management opens in the App Store. Sign in to the store account that bought the subscription and try again.",
      );
    }
    await refresh();
  }, [refresh]);

  /** Apple's refund sheet. iOS 15+; Android has no in-app equivalent. */
  const askForRefund = useCallback(async () => {
    const outcome = await requestRefund();
    if (outcome === "submitted") {
      Alert.alert(
        "Refund requested",
        "Apple has your request. They'll email you their decision.",
      );
    } else if (outcome === "unavailable") {
      Alert.alert(
        "Not available",
        Platform.OS === "ios"
          ? "We couldn't find a purchase to refund on this account."
          : "Refunds for Play Store purchases are requested from Google Play.",
      );
    }
    await refresh();
  }, [refresh]);

  /**
   * Every management action behind one tap.
   *
   * The Customer Center is the first option because it's the whole set in one
   * native screen; the rest are the same actions unbundled, for when it isn't
   * configured or the user knows exactly what they came for. A native action
   * sheet rather than a custom menu — this list is four items and platform
   * chrome already renders it correctly on both.
   */
  const openManageMenu = useCallback(() => {
    if (!isPro) {
      void openPaywall();
      return;
    }

    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: "Subscription details", onPress: () => void openCustomerCenter() },
      { text: "Change plan", onPress: () => void openPaywall() },
      { text: "Cancel subscription", onPress: () => void manageSubscription() },
    ];
    // iOS only: Google has no in-app refund flow, and an option that leads
    // nowhere is worse than no option.
    if (Platform.OS === "ios") {
      buttons.push({ text: "Request a refund", onPress: () => void askForRefund() });
    }
    buttons.push({ text: "Close", style: "cancel" });

    Alert.alert("Manage subscription", undefined, buttons);
  }, [isPro, openCustomerCenter, openPaywall, manageSubscription, askForRefund]);

  return {
    isPro,
    isReady,
    customerInfo,
    /** When the current period ends, for a "renews on" line. */
    expirationDate:
      customerInfo?.entitlements.active[PRO_ENTITLEMENT]?.expirationDate ?? null,
    /** True when the store says the subscription won't renew. */
    willRenew:
      customerInfo?.entitlements.active[PRO_ENTITLEMENT]?.willRenew ?? false,
    requirePro,
    openPaywall,
    openCustomerCenter,
    /** Store sheet where a subscription is actually cancelled or switched. */
    manageSubscription,
    /** iOS refund sheet for the active entitlement. */
    askForRefund,
    /** All of the above in one native action sheet. */
    openManageMenu,
    restore,
    refresh,
  };
}
