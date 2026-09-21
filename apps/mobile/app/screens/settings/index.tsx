import React, { useCallback, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Host, Form, Alert, Button, Text } from "@expo/ui/swift-ui";

import { usePreferences } from "@/hooks";
import {
  defaultPreferences,
  usePreferenceStore,
} from "@/store/preference-store";
import { syncPreferences } from "@/services/preferences-sync.service";
import { syncAppearanceOptionsOnce } from "@/services/appearance-sync.service";
import { AppearanceSection } from "./AppearanceSection";
import { PracticeSection } from "./PracticeSection";
import { StreakWidgetSection } from "./StreakWidgetSection";
import { DefaultMoodSection } from "./DefaultMoodSection";
import { SpeakingProfileSection } from "./SpeakingProfileSection";
import { CacheSection } from "./CacheSection";
import { SubscriptionSection } from "./SubscriptionSection";
import { LegalSection } from "./LegalSection";
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
  const setPreference = usePreferenceStore((state) => state.setPreference);
  const appearance = preferences?.appearance ?? defaultPreferences.appearance;

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
      <Stack.Screen options={{ title: "Settings" }} />
      <Host style={{ flex: 1 }}>
        <Form>
          <AppearanceSection
            selectedAppearance={appearance}
            onSelect={(app) => updatePreference("appearance", app)}
          />
          <PracticeSection
            emotionHapticsEnabled={preferences?.emotionHapticsEnabled ?? true}
            practiceRemindersEnabled={
              preferences?.practiceRemindersEnabled ?? true
            }
            practiceReminderTime={preferences?.practiceReminderTime ?? "18:00"}
            onUpdate={updatePreference}
          />
          {/* Local-only, so it goes straight to the store rather than through
              updatePreference — there is no server field to keep in step, and
              the store subscription in lib/widget-sync's caller pushes it to
              the widget. */}
          <StreakWidgetSection
            selectedColor={preferences.streakWidgetColor}
            onSelect={(hex) => setPreference("streakWidgetColor", hex)}
          />
          <DefaultMoodSection
            selectedMood={preferences?.defaultMood ?? "confident"}
            onUpdate={updatePreference}
          />
          <SpeakingProfileSection />
          <SubscriptionSection onMessage={showAlert} />
          <LegalSection />
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
