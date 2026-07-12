import React, { useState } from "react";
import { Section, Alert, Button, Text } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { useAccount } from "@/hooks";

const DESTRUCTIVE_RED = "#FF3B30";

interface AccountSecuritySectionProps {
  onDeleted: () => void;
  onError: (message: string) => void;
}

export function AccountSecuritySection({
  onDeleted,
  onError,
}: AccountSecuritySectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const { deleteAccount, isDeleting } = useAccount({
    onDeleted,
    onError: () => onError("Couldn't delete your account. Please try again."),
  });

  return (
    <Section
      title="Account & Security"
      footer={
        <Text>
          This permanently deletes your account, scripts, and practice history.
        </Text>
      }
    >
      <Alert
        title="Delete account?"
        isPresented={showConfirm}
        onIsPresentedChange={setShowConfirm}
      >
        <Alert.Trigger>
          <Button
            label="Delete Account"
            role="destructive"
            onPress={() => setShowConfirm(true)}
            modifiers={[buttonStyle("plain"), foregroundStyle(DESTRUCTIVE_RED)]}
          />
        </Alert.Trigger>
        <Alert.Actions>
          <Button
            label="Delete"
            role="destructive"
            onPress={deleteAccount}
            modifiers={[disabled(isDeleting)]}
          />
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
