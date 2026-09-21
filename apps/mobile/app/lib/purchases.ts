import { Linking, Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  REFUND_REQUEST_STATUS,
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
export const PRO_ENTITLEMENT = "pro";

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

/**
 * The subscription behind the Pro entitlement, flattened into what a card can
 * draw: what it is called, how long a cycle is, and when the cycle ends.
 *
 * The name comes from the store product rather than the entitlement, because
 * the entitlement is "pro" on every plan — a card built from it alone looks
 * identical before and after someone switches. The product is also where a
 * rename lands: renaming the plans in the dashboard changes this string with
 * no app release.
 */
export interface ActivePlan {
  productIdentifier: string;
  /** The plan's own name — "Wave", "Voyager". */
  name: string;
  /** "Monthly", "Annual", "Weekly"… or null when the store won't say. */
  period: string | null;
  expirationDate: string | null;
  willRenew: boolean;
  /** Set once the store knows the user has turned renewal off. */
  unsubscribeDetectedAt: string | null;
  isTrial: boolean;
  /** Sandbox or Test Store. Those renew on compressed cycles — a "monthly"
   *  plan can expire minutes after it is bought — which is worth saying out
   *  loud in a dev build before someone files it as a date bug. */
  isSandbox: boolean;
}

/** "sailor_pro_yearly" -> "Sailors Pro Yearly". Last resort only. */
const titleiseProductId = (id: string) =>
  id
    .split(/[.:_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const PERIOD_BY_PACKAGE_TYPE: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  TWO_MONTH: "2-monthly",
  THREE_MONTH: "Quarterly",
  SIX_MONTH: "6-monthly",
  ANNUAL: "Annual",
  LIFETIME: "Lifetime",
};

/** ISO 8601 subscription periods, which is what the stores actually return. */
const periodFromIso = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const match = /^P(\d+)([DWMY])$/.exec(iso);
  if (!match) return null;
  const [, count, unit] = match;
  if (count === "1") {
    return { D: "Daily", W: "Weekly", M: "Monthly", Y: "Annual" }[unit] ?? null;
  }
  const noun = { D: "day", W: "week", M: "month", Y: "year" }[unit];
  return noun ? `Every ${count} ${noun}s` : null;
};

/** The id is the last resort, and only because some stores name nothing. */
const periodFromId = (id: string): string | null => {
  const lower = id.toLowerCase();
  if (/year|annual|12m/.test(lower)) return "Annual";
  if (/month|1m|30d/.test(lower)) return "Monthly";
  if (/week/.test(lower)) return "Weekly";
  return null;
};

/**
 * @param offering the current offering, when it has been loaded. It is what
 * carries the store product — the plan's name and its billing period — so
 * without it this falls back to the customer info and then to the product id.
 */
export function activePlan(
  info: CustomerInfo | null,
  offering?: PurchasesOffering | null,
): ActivePlan | null {
  const entitlement = info?.entitlements.active[PRO_ENTITLEMENT];
  if (!info || !entitlement) return null;

  const productId = entitlement.productIdentifier;
  const subscription = info.subscriptionsByProductIdentifier?.[productId] ?? null;
  // Google Play appends the base plan to the product id in the entitlement
  // ("sailor_pro:monthly"), so match on both forms.
  const pkg = offering?.availablePackages.find(
    (candidate) =>
      candidate.product.identifier === productId ||
      productId.startsWith(`${candidate.product.identifier}:`),
  );

  return {
    productIdentifier: productId,
    name:
      pkg?.product.title?.trim() ||
      subscription?.displayName?.trim() ||
      titleiseProductId(productId),
    period:
      (pkg ? PERIOD_BY_PACKAGE_TYPE[pkg.packageType] : undefined) ??
      periodFromIso(pkg?.product.subscriptionPeriod) ??
      periodFromId(productId),
    expirationDate: entitlement.expirationDate,
    willRenew: entitlement.willRenew,
    unsubscribeDetectedAt: entitlement.unsubscribeDetectedAt,
    isTrial: entitlement.periodType === "TRIAL",
    isSandbox: entitlement.isSandbox,
  };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
//
// The app's users are Clerk users, so the RevenueCat app user id is the Clerk
// id: one subscription follows one person across their devices and reinstalls.
// Purchases made before sign-in are aliased onto that id automatically on the
// first logIn, so an anonymous trial purchase is never stranded.

export async function loginPurchases(
  appUserId: string,
): Promise<CustomerInfo | null> {
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

/**
 * Current customer info.
 *
 * `force` throws away the SDK's own cache first. That cache is why a plan
 * change didn't show up: RevenueCat serves the last payload for five minutes,
 * and switching plan, cancelling, or resubscribing all happen well inside that
 * window — so the card kept drawing the plan the user had just left. Every
 * read that follows a management action, and every app foreground, asks for
 * the real thing.
 */
export async function fetchCustomerInfo(
  force = false,
): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    if (force) await Purchases.invalidateCustomerInfoCache();
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

export type PaywallOutcome =
  | "purchased"
  | "restored"
  | "dismissed"
  | "unavailable";

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
  onCustomerInfo?: (info: CustomerInfo) => void,
): Promise<boolean> {
  if (!configured) return false;
  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo }) => onCustomerInfo?.(customerInfo),
        onManagementOptionSelected: (event: any) => {
          // A `custom_url` option is a link the dashboard configured — support
          // contact, a help page — and nothing opens it but us.
          if (event?.option === "custom_url" && event?.url) {
            void Linking.openURL(event.url);
          }
        },
      },
    });
    // Cancelling doesn't revoke the entitlement (they keep it to the end of the
    // period), but it does flip `willRenew` — so the "Renews 3 Mar" line only
    // becomes "Ends 3 Mar" if something re-reads customer info on the way out.
    const info = await fetchCustomerInfo();
    if (info) onCustomerInfo?.(info);
    return true;
  } catch (e) {
    // Not configured in the dashboard, or no store to manage (Test Store).
    // Callers fall back to the individual actions below.
    console.warn("[RevenueCat] presentCustomerCenter failed", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Individual management actions
// ---------------------------------------------------------------------------
//
// The Customer Center covers all of these behind one screen, and it's the
// better door when it's available. These exist because it isn't always: it has
// to be configured in the dashboard, it needs a live store connection, and on
// the Test Store there's nothing for it to manage. Each one drops straight to
// the platform's own flow instead.

/**
 * The store's own subscription screen — where cancelling and switching plans
 * actually happen. Neither store lets an app cancel on the user's behalf; the
 * most any app can do is take them to the right sheet.
 */
export async function openManageSubscriptions(): Promise<boolean> {
  if (!configured) return false;
  try {
    await Purchases.showManageSubscriptions();
    return true;
  } catch (e) {
    // Older iOS, or no store account attached. `managementURL` is the same
    // destination as a plain link, which is why RevenueCat ships it on every
    // customer info payload.
    const info = await fetchCustomerInfo();
    if (info?.managementURL) {
      await Linking.openURL(info.managementURL);
      return true;
    }
    console.warn("[RevenueCat] showManageSubscriptions failed", e);
    return false;
  }
}

export type RefundOutcome = "submitted" | "cancelled" | "unavailable";

/**
 * Apple's refund sheet, for the transaction behind the active entitlement.
 *
 * iOS 15+ only, and deliberately not faked on Android: Google has no in-app
 * equivalent, so the Play subscriptions screen (above) is where an Android user
 * goes, and telling them otherwise would be a dead end.
 */
export async function requestRefund(): Promise<RefundOutcome> {
  if (!configured || Platform.OS !== "ios") return "unavailable";
  try {
    const status = await Purchases.beginRefundRequestForActiveEntitlement();
    return status === REFUND_REQUEST_STATUS.USER_CANCELLED
      ? "cancelled"
      : status === REFUND_REQUEST_STATUS.SUCCESS
        ? "submitted"
        : "unavailable";
  } catch (e) {
    // Thrown when there's no active entitlement, more than one, or the platform
    // is too old — none of which is worth an error dialog on a refund button.
    console.warn("[RevenueCat] beginRefundRequestForActiveEntitlement failed", e);
    return "unavailable";
  }
}
