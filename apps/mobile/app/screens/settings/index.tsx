import React, { useCallback, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Host, Form, Alert, Button, Text } from "@expo/ui/swift-ui";

import { usePreferences } from "@/hooks";
import { usePreferenceStore } from "@/store/preference-store";
import { syncPreferences } from "@/services/preferences-sync.service";
import { syncAppearanceOptionsOnce } from "@/services/appearance-sync.service";
import { PracticeSection } from "./PracticeSection";
import { DefaultMoodSection } from "./DefaultMoodSection";
import { CacheSection } from "./CacheSection";
import { SubscriptionSection } from "./SubscriptionSection";
import { VersionSection } from "./VersionSection";
import { AccountSecuritySection } from "./AccountSecuritySection";
import { SentryTestSection } from "./SentryTestSection";
// [COMMENT LATER]
import { DevStreakSection } from "./DevStreakSection";

const SettingsScreen = () => {
  const router = useRouter();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const preferences = usePreferenceStore((state) => state.preferences);

  const { updatePreference } = usePreferences({
    onError: () => {
      setAlertMessage(
        "That change didn't save. Check your connection and try again.",
      );
      setAlertVisible(true);
    },
  });

  const showAlert = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const handleCacheCleared = useCallback(() => {
    setAlertMessage("Cache cleared. Data will refetch automatically.");
    setAlertVisible(true);
    // Sync preferences and appearance options from server
    syncPreferences();
    syncAppearanceOptionsOnce();
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Preferences" }} />
      <Host style={{ flex: 1 }}>
        <Form>
          <PracticeSection
            emotionHapticsEnabled={preferences?.emotionHapticsEnabled ?? true}
            practiceRemindersEnabled={
              preferences?.practiceRemindersEnabled ?? true
            }
            practiceReminderTime={preferences?.practiceReminderTime ?? "18:00"}
            onUpdate={updatePreference}
          />
          <DefaultMoodSection
            selectedMood={preferences?.defaultMood ?? "confident"}
            onUpdate={updatePreference}
          />
          <SubscriptionSection onMessage={showAlert} />
          <CacheSection onCleared={handleCacheCleared} />
          <VersionSection />
          <AccountSecuritySection
            onDeleted={() => router.replace("/")}
            onError={showAlert}
          />
          {__DEV__ && <SentryTestSection onMessage={showAlert} />}
          {/* [COMMENT LATER] */}
          {__DEV__ && <DevStreakSection onMessage={showAlert} />}
        </Form>

        <Alert
          title="Heads Up"
          isPresented={alertVisible}
          onIsPresentedChange={setAlertVisible}
        >
          <Alert.Actions>
            <Button label="OK" onPress={() => setAlertVisible(false)} />
          </Alert.Actions>
          <Alert.Message>
            <Text>{alertMessage}</Text>
          </Alert.Message>
        </Alert>
      </Host>
    </>
  );
};

export default SettingsScreen;
