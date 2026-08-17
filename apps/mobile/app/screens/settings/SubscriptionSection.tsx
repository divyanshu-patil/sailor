import React, { useState } from "react";
import { Section, Button, Text, HStack, Spacer } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";

import { useSubscription } from "@/hooks/use-subscription";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Subscription management, straight into RevenueCat's own UI.
 *
 * "Manage" means two different things depending on who is asking, so it points
 * at two different places: a subscriber gets the Customer Center — cancel,
 * change plan, request a refund, restore, all rendered natively from the
 * dashboard config — and everyone else gets the paywall.
 *
 * Restore stands on its own for the second group. Apple requires a reachable
 * restore action, and a returning subscriber on a fresh install has no
 * entitlement yet, so the Customer Center's own restore button is behind
 * exactly the state they're trying to recover.
 */
export function SubscriptionSection({
  onMessage,
}: {
  /** Surfaces the restore result through the screen's existing alert. */
  onMessage: (message: string) => void;
}) {
  const { isPro, isReady, expirationDate, willRenew, openCustomerCenter, openPaywall, restore } =
    useSubscription();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    const restored = await restore();
    setIsRestoring(false);
    onMessage(
      restored
        ? "Your subscription is back. Welcome to Pro."
        : "No previous purchases found for this store account.",
    );
  };

  // The renewal line is the one thing the Customer Center can't say from out
  // here: whether the plan is still running, and until when.
  const status = !isReady
    ? "Checking…"
    : !isPro
      ? "Basic"
      : expirationDate
        ? `${willRenew ? "Renews" : "Ends"} ${formatDate(expirationDate)}`
        : "Pro";

  return (
    <Section
      title="Subscription"
      footer={
        <Text>
          {isPro
            ? "Cancel, switch plans or request a refund from the subscription screen."
            : "Pro unlocks script generation. Already subscribed? Restore below."}
        </Text>
      }
    >
      <HStack alignment="lastTextBaseline">
        <Button
          label={isPro ? "Manage Subscription" : "Upgrade to Pro"}
          onPress={isPro ? openCustomerCenter : openPaywall}
          modifiers={[buttonStyle("plain")]}
        />
        <Spacer />
        <Text
          modifiers={[
            font({ size: 13 }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
          ]}
        >
          {status}
        </Text>
      </HStack>

      {/* Subscribers restore from inside the Customer Center, which also knows
          how to explain the result — no reason to offer it twice. */}
      {!isPro && (
        <Button
          label={isRestoring ? "Restoring…" : "Restore Purchases"}
          onPress={handleRestore}
          modifiers={[buttonStyle("plain")]}
        />
      )}
    </Section>
  );
}
