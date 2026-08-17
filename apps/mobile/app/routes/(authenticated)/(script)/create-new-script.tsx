import { useCallback } from "react";
import { Modal, View } from "react-native";
import { router, Stack } from "expo-router";
import CreateNewScriptScreen from "@/screens/presentation/new-script";
import { PaywallScreen } from "@/screens/paywall";
import { useSubscription } from "@/hooks/use-subscription";

/**
 * Creating a script is the Pro feature, so the gate lives here rather than on
 * the buttons that push this route.
 *
 * Two screens push "New Script" today and a deep link could arrive tomorrow;
 * one guard at the destination covers all of them, and it can't be forgotten at
 * a new call site the way a check before each `router.push` can.
 *
 * The paywall is a plain `Modal` rather than a route in the `modals` group,
 * because a routed modal needs a sibling screen beneath it *in its own stack* to
 * present over — navigating into `(script)/modals/…` from outside that stack
 * leaves it alone at the bottom, and iOS renders it as a full-screen card.
 * `presentationStyle="pageSheet"` is the same iOS sheet, with none of that
 * coupling to how the user arrived.
 */
const CreateNewScript = () => {
  const { isPro, isReady } = useSubscription();

  // Visibility is derived, not stored: the sheet is open exactly when the user
  // is known not to have Pro. A purchase flips `isPro` through the customer
  // info listener and the sheet closes on its own — no state to keep in step.
  const showPaywall = isReady && !isPro;

  // Closing without buying leaves the whole route, not just the sheet —
  // otherwise the user is stranded on the blank screen the gate renders.
  const dismiss = useCallback(() => router.back(), []);

  return (
    <>
      {isPro ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon={"chevron.backward"}
              onPress={() => router.back()}
            ></Stack.Toolbar.Button>
          </Stack.Toolbar>
          <CreateNewScriptScreen />
        </>
      ) : (
        // Nothing until the SDK has answered — it reads from a native cache and
        // takes milliseconds. The create screen must not paint for someone who
        // isn't allowed in it.
        <View style={{ flex: 1 }} />
      )}

      <Modal
        visible={showPaywall}
        animationType="slide"
        presentationStyle="pageSheet"
        // Android's hardware back button. Without this the sheet is a trap.
        onRequestClose={dismiss}
      >
        {/* No onEntitled: buying flips `isPro`, which closes this sheet and
            reveals the create screen underneath. */}
        <PaywallScreen onDismiss={dismiss} />
      </Modal>
    </>
  );
};

export default CreateNewScript;
