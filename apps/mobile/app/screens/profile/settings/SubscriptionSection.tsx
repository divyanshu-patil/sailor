import React, { useCallback, useState } from "react";
import { Section, Alert, Button, Text } from "@expo/ui/swift-ui";
import { buttonStyle } from "@expo/ui/swift-ui/modifiers";

export function SubscriptionSection() {
  const [alertVisible, setAlertVisible] = useState(false);

  const openAlert = useCallback(() => setAlertVisible(true), []);

  return (
    <Section title="Subscription">
      <Alert
        title="Heads Up"
        isPresented={alertVisible}
        onIsPresentedChange={setAlertVisible}
      >
        <Alert.Trigger>
          <Button
            label="Manage Subscription"
            onPress={openAlert}
            modifiers={[buttonStyle("plain")]}
          />
        </Alert.Trigger>
        <Alert.Actions>
          <Button label="OK" onPress={() => setAlertVisible(false)} />
        </Alert.Actions>
        <Alert.Message>
          <Text>
            Subscription management is coming soon, powered by RevenueCat.
          </Text>
        </Alert.Message>
      </Alert>
    </Section>
  );
}
