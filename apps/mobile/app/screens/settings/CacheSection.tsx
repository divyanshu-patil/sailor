import React, { useState } from "react";
import { Section, Button, Alert, Text } from "@expo/ui/swift-ui";
import { buttonStyle, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

const RED = "#FF3B30";

interface CacheSectionProps {
  onCleared: () => void;
}

export function CacheSection({ onCleared }: CacheSectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClear = async () => {
    try {
      const { clearAllCache } = await import("@/utils/cache");
      clearAllCache();
      router.dismiss();
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }
    setShowConfirm(false);
    onCleared();
  };

  return (
    <Section
      title="Cache"
      footer={<Text>{`This clears your app's cache and refreshes app`}</Text>}
    >
      <Alert
        title="Clear Cache?"
        isPresented={showConfirm}
        onIsPresentedChange={setShowConfirm}
      >
        <Alert.Trigger>
          <Button
            onPress={() => setShowConfirm(true)}
            role="destructive"
            label="Clear Cache"
            modifiers={[buttonStyle("plain"), foregroundStyle(RED)]}
          />
        </Alert.Trigger>
        <Alert.Actions>
          <Button label="Clear" role="destructive" onPress={handleClear} />
          <Button label="Cancel" role="cancel" />
        </Alert.Actions>
        <Alert.Message>
          <Text>
            This will clear locally cached data and refetch from server.
          </Text>
        </Alert.Message>
      </Alert>
    </Section>
  );
}
