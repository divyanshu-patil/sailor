import { create } from "zustand";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

import {
  fetchCurrentOffering,
  fetchCustomerInfo,
  hasProEntitlement,
  purchasePackage,
  restorePurchases,
  type PurchaseOutcome,
} from "@/lib/purchases";

/**
 * Subscription state, in one store.
 *
 * `isPro` is derived from customerInfo on every write rather than stored as its
 * own fact — two booleans that are supposed to agree eventually don't. Nothing
 * outside this file sets it: a purchase, a restore, a renewal on another device
 * and an expiry all arrive as customer info, from the SDK listener registered
 * in use-subscription, and all take this same path.
 *
 * Not persisted. The native SDK already caches the last customer info and
 * serves it on the first call, so a cold start gets the real answer in
 * milliseconds — and a persisted `isPro` would keep a lapsed subscriber unlocked
 * offline, which is the one direction a paid gate must never fail in.
 */
interface SubscriptionStore {
  customerInfo: CustomerInfo | null;
  isPro: boolean;
  /** False until the first customer info lands — the gate shouldn't flash
   *  "upgrade" at a subscriber while the SDK is still starting up. */
  isReady: boolean;

  offering: PurchasesOffering | null;
  isLoadingOffering: boolean;

  /** In-flight guard for the manual purchase path, so a double tap can't fire
   *  two store transactions. */
  isPurchasing: boolean;
  error: string | null;

  /** The single write path for entitlement state. */
  applyCustomerInfo: (info: CustomerInfo | null) => void;
  refresh: () => Promise<void>;
  loadOffering: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  restore: () => Promise<boolean>;
  clearError: () => void;
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  customerInfo: null,
  isPro: false,
  isReady: false,
  offering: null,
  isLoadingOffering: false,
  isPurchasing: false,
  error: null,

  applyCustomerInfo: (info) =>
    set({ customerInfo: info, isPro: hasProEntitlement(info), isReady: true }),

  refresh: async () => {
    const info = await fetchCustomerInfo();
    get().applyCustomerInfo(info);
  },

  loadOffering: async () => {
    if (get().isLoadingOffering) return;
    set({ isLoadingOffering: true });
    const offering = await fetchCurrentOffering();
    set({ offering, isLoadingOffering: false });
  },

  purchase: async (pkg) => {
    if (get().isPurchasing) return { kind: "cancelled" } as PurchaseOutcome;
    set({ isPurchasing: true, error: null });

    const outcome = await purchasePackage(pkg);

    if (outcome.kind === "purchased") get().applyCustomerInfo(outcome.customerInfo);
    // A dismissed store sheet is not an error and gets no message — the user
    // knows they cancelled, they were the one who did it.
    if (outcome.kind === "failed") set({ error: outcome.message });

    set({ isPurchasing: false });
    return outcome;
  },

  restore: async () => {
    set({ error: null });
    const info = await restorePurchases();
    if (!info) {
      set({ error: "Couldn't restore your purchases. Try again in a moment." });
      return false;
    }
    get().applyCustomerInfo(info);
    return hasProEntitlement(info);
  },

  clearError: () => set({ error: null }),
}));

/** The gate itself. `useIsPro()` is what feature code should read. */
export const useIsPro = () => useSubscriptionStore((s) => s.isPro);
export const useSubscriptionReady = () => useSubscriptionStore((s) => s.isReady);
