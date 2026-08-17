import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

import { ENV } from "./config/env";

/**
 * Everything that talks to RevenueCat, in one file.
 *
 * The store (store/subscription.store.ts) holds the *state*; this holds the
 * calls. Keeping them apart is what lets the store be the single place the UI
 * reads entitlement from, while every SDK quirk — the platform key split, the
 * anonymous-logout error, the cancelled-purchase rejection — is handled once,
 * here.
 */

/**
 * The entitlement identifier configured in the RevenueCat dashboard. Case
 * sensitive, and it is *not* the product id: products come and go (monthly,
 * yearly, a launch promo), the entitlement is the access they all grant.
 */
export const PRO_ENTITLEMENT = "Sailors Pro";

/**
 * Purchases can't run at all without a native module, so web is out — and the
 * app is expected to keep working there, minus billing.
 */
export const isPurchasesSupported =
  Platform.OS === "ios" || Platform.OS === "android";

const apiKey =
  Platform.OS === "ios"
    ? ENV.REVENUECAT_IOS_API_KEY
    : ENV.REVENUECAT_ANDROID_API_KEY;

let configured = false;

/**
 * Configure once per app launch, as early as possible.
 *
 * Synchronous by design — the SDK kicks off its own async init, so callers can
 * fetch offerings on the next line without awaiting anything. A second call is
 * a no-op rather than a reconfigure, because Fast Refresh re-runs the effect
 * that calls this on every save.
 */
export function configurePurchases(): boolean {
  if (configured) return true;
  if (!isPurchasesSupported || !apiKey) return false;

  // Debug logs are where a wrong key shows up (an auth error on the first
  // offerings fetch). Never on in release: they're verbose and they print
  // transaction detail.
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
  configured = true;
  return true;
}

export const isPurchasesConfigured = () => configured;

/** Whether a customer info payload grants Pro. The one place that decides. */
export const hasProEntitlement = (info: CustomerInfo | null): boolean =>
  !!info && info.entitlements.active[PRO_ENTITLEMENT] !== undefined;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
//
// The app's users are Clerk users, so the RevenueCat app user id is the Clerk
// id: one subscription follows one person across their devices and reinstalls.
// Purchases made before sign-in are aliased onto that id automatically on the
// first logIn, so an anonymous trial purchase is never stranded.

export async function loginPurchases(appUserId: string): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(appUserId);
    return customerInfo;
  } catch (e) {
    console.warn("[RevenueCat] logIn failed", e);
    return null;
  }
}

export async function logoutPurchases(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    // logOut on an already-anonymous SDK rejects, and signing out twice (or
    // signing out of an app that never signed in) is an ordinary thing for a
    // user to do — so check first rather than catch-and-shrug.
    const info = await Purchases.getCustomerInfo();
    if (info.originalAppUserId.startsWith("$RCAnonymousID:")) return info;
    return await Purchases.logOut();
  } catch (e) {
    console.warn("[RevenueCat] logOut failed", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reading state
// ---------------------------------------------------------------------------

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    // Offline or auth failure. The caller treats null as "no access" — failing
    // closed is the only safe direction for a paid feature.
    console.warn("[RevenueCat] getCustomerInfo failed", e);
    return null;
  }
}

export async function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.warn("[RevenueCat] getOfferings failed", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------

export type PurchaseOutcome =
  | { kind: "purchased"; customerInfo: CustomerInfo }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

/**
 * Buy a package.
 *
 * A dismissed store sheet is not an error — it's the most common outcome of any
 * paywall — so it gets its own result rather than an alert. Access itself is
 * never unlocked from here: the customer info listener in the store is the only
 * thing that flips the gate, so a purchase, a restore and a renewal on another
 * device all take the same path.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { kind: "purchased", customerInfo };
  } catch (e: any) {
    if (e?.userCancelled === true) return { kind: "cancelled" };
    return {
      kind: "failed",
      message: e?.message ?? "Something went wrong with that purchase.",
    };
  }
}

/** Re-grant a subscription bought on another device or before a reinstall. */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    console.warn("[RevenueCat] restorePurchases failed", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// RevenueCat UI — paywall and customer center
// ---------------------------------------------------------------------------
//
// Both are rendered natively from the dashboard configuration, which is the
// point: pricing, copy and layout change from the dashboard without an app
// release. The app's job is to open them at the right moment and to trust the
// entitlement afterwards, not to re-implement a purchase flow around them.

export type PaywallOutcome = "purchased" | "restored" | "dismissed" | "unavailable";

const toPaywallOutcome = (result: PAYWALL_RESULT): PaywallOutcome => {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return "purchased";
    case PAYWALL_RESULT.RESTORED:
      return "restored";
    case PAYWALL_RESULT.CANCELLED:
      return "dismissed";
    default:
      return "unavailable";
  }
};

/** Always shows the paywall. For an explicit "upgrade" tap. */
export async function presentPaywall(
  offering?: PurchasesOffering,
): Promise<PaywallOutcome> {
  if (!configured) return "unavailable";
  try {
    return toPaywallOutcome(
      await RevenueCatUI.presentPaywall({ offering, displayCloseButton: true }),
    );
  } catch (e) {
    console.warn("[RevenueCat] presentPaywall failed", e);
    return "unavailable";
  }
}

/**
 * Shows the paywall only if the user lacks Pro — the right call in front of a
 * gated action, because a subscriber tapping it should just get the feature.
 */
export async function presentPaywallIfNeeded(): Promise<PaywallOutcome> {
  if (!configured) return "unavailable";
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT,
      displayCloseButton: true,
    });
    // NOT_PRESENTED means they already had the entitlement, which for a caller
    // asking "can they proceed?" is the same answer as a fresh purchase.
    if (result === PAYWALL_RESULT.NOT_PRESENTED) return "purchased";
    return toPaywallOutcome(result);
  } catch (e) {
    console.warn("[RevenueCat] presentPaywallIfNeeded failed", e);
    return "unavailable";
  }
}

/**
 * The subscription management UI: current plan, cancel, change plan, refund
 * request (iOS), and its own restore button — which is why nothing here calls
 * restorePurchases while it's open.
 */
export async function presentCustomerCenter(
  onRestore?: (info: CustomerInfo) => void,
): Promise<void> {
  if (!configured) return;
  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo }) => onRestore?.(customerInfo),
      },
    });
  } catch (e) {
    console.warn("[RevenueCat] presentCustomerCenter failed", e);
  }
}
