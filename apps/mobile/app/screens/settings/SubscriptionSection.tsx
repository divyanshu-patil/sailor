import React, { useState } from "react";
import { Platform } from "react-native";
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
 * Subscription management, spelled out.
 *
 * The profile screen puts all of this behind one "Manage" tap, which is right
 * for a card with one button. A settings list is the opposite: the whole point
 * is that the actions are visible without hunting, so cancel, change plan and
 * refund each get their own row rather than hiding inside the Customer Center.
 * They're the same calls either way.
 *
 * Restore stands alone for non-subscribers. Apple requires a reachable restore
 * action, and a returning subscriber on a fresh install has no entitlement yet
 * — so the Customer Center's own restore button is behind exactly the state
 * they're trying to recover.
 */
export function SubscriptionSection({
  onMessage,
}: {
  /** Surfaces results through the screen's existing alert. */
  onMessage: (message: string) => void;
}) {
  const {
    isPro,
    isReady,
    expirationDate,
    willRenew,
    openCustomerCenter,
    openPaywall,
    manageSubscription,
    askForRefund,
    restore,
  } = useSubscription();
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

  // The renewal line is the one thing the store sheet can't say from out here:
  // whether the plan is still running, and until when.
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
            ? "Cancelling keeps Pro until the end of the period you've paid for."
            : "Pro unlocks script generation. Already subscribed? Restore below."}
        </Text>
      }
    >
      <HStack alignment="lastTextBaseline">
        <Button
          label={isPro ? "Subscription Details" : "Upgrade to Pro"}
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

      {isPro && (
        <Button
          label="Change Plan"
          onPress={openPaywall}
          modifiers={[buttonStyle("plain")]}
        />
      )}

      {/* Neither store lets an app cancel on the user's behalf — the most any
          app can do is open the right sheet, which is what this does. */}
      {isPro && (
        <Button
          label="Cancel Subscription"
          onPress={manageSubscription}
          modifiers={[buttonStyle("plain")]}
        />
      )}

      {/* iOS only: Google has no in-app refund flow, so on Android this row
          would lead nowhere. Play refunds start from the Play Store. */}
      {isPro && Platform.OS === "ios" && (
        <Button
          label="Request a Refund"
          onPress={askForRefund}
          modifiers={[buttonStyle("plain")]}
        />
      )}

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
