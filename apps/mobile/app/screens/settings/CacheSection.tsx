import React, { useEffect, useState } from "react";
import {
  Section,
  Button,
  Alert,
  Text,
  HStack,
  Spacer,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { getCacheSizeBytes, formatBytes, clearAllCache } from "@/utils/cache";
import { usePreferenceStore } from "@/store/preference-store";

const RED = "#FF3B30";

interface CacheSectionProps {
  onCleared: () => void;
}

function computeCacheSizeLabel(): string | null {
  try {
    return formatBytes(getCacheSizeBytes());
  } catch (e) {
    console.error("Failed to compute cache size:", e);
    return null;
  }
}

export function CacheSection({ onCleared }: CacheSectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [cacheSizeLabel, setCacheSizeLabel] = useState<string | null>(
    computeCacheSizeLabel,
  );

  useEffect(() => {
    // React to real changes in the persisted slices of the store — this is
    // a genuine external-system subscription, not a derived-state effect.
    const unsubscribe = usePreferenceStore.subscribe((state, prevState) => {
      if (
        state.preferences !== prevState.preferences ||
        state.appearanceOptions !== prevState.appearanceOptions
      ) {
        setCacheSizeLabel(computeCacheSizeLabel());
      }
    });
    return unsubscribe;
  }, []);

  const handleClear = async () => {
    try {
      clearAllCache();
      router.dismiss();
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }
    setShowConfirm(false);
    onCleared();
    // No manual refresh needed — clearAllCache() changes preferences/
    // appearanceOptions, which the subscription above picks up.
  };

  return (
    <Section
      title="Cache"
      footer={
        <Text>
          {cacheSizeLabel
            ? `Currently using ${cacheSizeLabel}. Clearing refreshes app data from server.`
            : "This clears your app's cache and refreshes app"}
        </Text>
      }
    >
      <Alert
        title="Clear Cache?"
        isPresented={showConfirm}
        onIsPresentedChange={setShowConfirm}
      >
        <Alert.Trigger>
          <HStack alignment="lastTextBaseline">
            <Button
              onPress={() => setShowConfirm(true)}
              role="destructive"
              label="Clear Cache"
              modifiers={[buttonStyle("plain"), foregroundStyle(RED)]}
            />
            <Spacer />
            <Text
              modifiers={[
                font({ size: 13 }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
              ]}
            >
              {cacheSizeLabel}
            </Text>
          </HStack>
        </Alert.Trigger>
        <Alert.Actions>
          <Button label="Clear" role="destructive" onPress={handleClear} />
          <Button label="Cancel" role="cancel" />
        </Alert.Actions>
        <Alert.Message>
          <Text>
            {cacheSizeLabel
              ? `This will clear ${cacheSizeLabel} of locally cached data and refetch from server.`
              : "This will clear locally cached data and refetch from server."}
          </Text>
        </Alert.Message>
      </Alert>
    </Section>
  );
}
