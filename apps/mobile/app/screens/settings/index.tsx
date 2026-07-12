import React, { useCallback, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Host, Form, Alert, Button, Text } from "@expo/ui/swift-ui";

import { usePreferences } from "@/hooks";
import { usePreferenceStore } from "@/store/preference-store";
import { AppearanceOption } from "@/types/settings/preferences";
import { AppearanceSection } from "./AppearanceSection";
import { PracticeSection } from "./PracticeSection";
import { DefaultMoodSection } from "./DefaultMoodSection";
import { SubscriptionSection } from "./SubscriptionSection";
import { LegalSection } from "./LegalSection";
import { VersionSection } from "./VersionSection";
import { AccountSecuritySection } from "./AccountSecuritySection";

const defaultAppearance: AppearanceOption = { id: "lavender", name: "Lavender", hex: "#B794F4" };

const SettingsScreen = () => {
  const router = useRouter();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const preferences = usePreferenceStore((state) => state.preferences);
  const appearance = preferences?.appearance ?? defaultAppearance;

  const { updatePreference } = usePreferences({
    onError: () => {
      setAlertMessage("That change didn't save. Check your connection and try again.");
      setAlertVisible(true);
    },
  });

  const showAlert = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
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
            practiceRemindersEnabled={preferences?.practiceRemindersEnabled ?? true}
            practiceReminderTime={preferences?.practiceReminderTime ?? "18:00"}
            onUpdate={updatePreference}
          />
          <DefaultMoodSection
            selectedMood={preferences?.defaultMood ?? "confident"}
            onUpdate={updatePreference}
          />
          <SubscriptionSection />
          <LegalSection />
          <VersionSection />
          <AccountSecuritySection
            onDeleted={() => router.replace("/")}
            onError={showAlert}
          />
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