import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";
import type { CustomerInfo } from "react-native-purchases";

import { haptics } from "@/lib/haptics";
import { isPurchasesConfigured } from "@/lib/purchases";
import { useSubscriptionStore } from "@/store/subscription.store";

/**
 * The dashboard-configured paywall, rendered inline as a screen.
 *
 * The component form rather than `presentPaywall()`: this one *is* the screen,
 * so it takes part in the stack — the back gesture works, and the screen behind
 * it (the create flow) is only reached by getting past it. The imperative form
 * is still right for a paywall opened from a button, which is what the profile's
 * Manage action uses.
 *
 * Everything visual — copy, packages, prices, layout — comes from the RevenueCat
 * dashboard, so pricing experiments ship without an app release. Nothing here
 * calls purchasePackage: the paywall drives its own purchase, and the entitlement
 * that results reaches the app through the customer info listener.
 */
export const PaywallScreen = ({
  onDismiss,
  onEntitled,
}: {
  /** Closed without buying — the caller decides where that goes. */
  onDismiss: () => void;
  /** Purchased or restored. Fires *after* the store has the new entitlement. */
  onEntitled?: () => void;
}) => {
  const applyCustomerInfo = useSubscriptionStore((s) => s.applyCustomerInfo);

  useEffect(() => {
    // A misconfigured build (no API key, or web) can't render a paywall, and a
    // blank screen with no way out is worse than no gate at all.
    if (!isPurchasesConfigured()) onDismiss();
  }, [onDismiss]);

  const grant = (customerInfo: CustomerInfo) => {
    // Money changed hands, or a subscriber got their access back. One of the
    // few things in the app that earns the big one.
    haptics.successBig();
    applyCustomerInfo(customerInfo);
    onEntitled?.();
  };

  // The effect above is already dismissing, and without the SDK bundled there
  // is no Paywall component to render in the meantime.
  if (!isPurchasesConfigured()) return null;

  return (
    // A native view host: it needs a real size, or it renders as nothing.
    <View style={styles.container}>
      <RevenueCatUI.Paywall
        options={{ displayCloseButton: true }}
        onPurchaseCompleted={({ customerInfo }) => grant(customerInfo)}
        // Restore belongs on every paywall — a subscriber reinstalling the app
        // must be able to get back in without paying twice.
        onRestoreCompleted={({ customerInfo }) => grant(customerInfo)}
        onPurchaseError={({ error }) => {
          // The paywall shows its own error UI; this is only for the log —
          // and for the one thing a native paywall cannot do from here, which
          // is tell the hand that the purchase did not go through.
          haptics.error();
          console.warn("[RevenueCat] paywall purchase failed", error);
        }}
        onDismiss={onDismiss}
      />
    </View>
  );
};

export default PaywallScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
