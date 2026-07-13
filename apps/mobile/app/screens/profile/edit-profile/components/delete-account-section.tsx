import React from "react";
import { Section, Alert, Button, Text } from "@expo/ui/swift-ui";
import { buttonStyle, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { DESTRUCTIVE_RED } from "./constants";

interface DeleteAccountSectionProps {
  isPresented: boolean;
  onIsPresentedChange: (value: boolean) => void;
  onConfirmDelete: () => void;
}

export function DeleteAccountSection({
  isPresented,
  onIsPresentedChange,
  onConfirmDelete,
}: DeleteAccountSectionProps) {
  return (
    <Section
      title="Account Management"
      footer={
        <Text>
          This permanently deletes your account, scripts, and practice history.
        </Text>
      }
    >
      <Alert
        title="Delete account?"
        isPresented={isPresented}
        onIsPresentedChange={onIsPresentedChange}
      >
        <Alert.Trigger>
          <Button
            label="Delete Account"
            role="destructive"
            onPress={() => onIsPresentedChange(true)}
            modifiers={[buttonStyle("plain"), foregroundStyle(DESTRUCTIVE_RED)]}
          />
        </Alert.Trigger>
        <Alert.Actions>
          <Button label="Delete" role="destructive" onPress={onConfirmDelete} />
          <Button label="Cancel" role="cancel" />
        </Alert.Actions>
        <Alert.Message>
          <Text>
            This permanently deletes your account and all data. This cannot be
            undone.
          </Text>
        </Alert.Message>
      </Alert>
    </Section>
  );
}
