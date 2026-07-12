// SettingsScreen.tsx
import React, { useCallback, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  Host,
  Form,
  VStack,
  HStack,
  Spacer,
  Alert,
  Button,
  Text,
  ProgressView,
} from "@expo/ui/swift-ui";
import { frame, progressViewStyle } from "@expo/ui/swift-ui/modifiers";

import { usePreferences } from "@/hooks";
import { AppearanceSection } from "./AppearanceSection";
import { PracticeSection } from "./PracticeSection";
import { DefaultMoodSection } from "./DefaultMoodSection";
import { SubscriptionSection } from "./SubscriptionSection";
import { LegalSection } from "./LegalSection";
import { VersionSection } from "./VersionSection";
import { AccountSecuritySection } from "./AccountSecuritySection";

const SettingsScreen = () => {
  const router = useRouter();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const {
    data: preferences,
    isLoading,
    updatePreference,
  } = usePreferences({
    onError: () =>
      showAlert(
        "That change didn't save. Check your connection and try again.",
      ),
  });

  if (isLoading || !preferences) {
    return (
      <>
        <Stack.Screen options={{ title: "Settings" }} />
        <Host style={{ flex: 1 }}>
          <VStack
            modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
          >
            <Spacer />
            <HStack>
              <Spacer />
              <ProgressView modifiers={[progressViewStyle("circular")]} />
              <Spacer />
            </HStack>
            <Spacer />
          </VStack>
        </Host>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <Host style={{ flex: 1 }}>
        <Form>
          <AppearanceSection
            selectedId={preferences.appearanceId}
            onSelect={(id) => updatePreference("appearanceId", id)}
          />

          <PracticeSection
            emotionHapticsEnabled={preferences.emotionHapticsEnabled}
            practiceRemindersEnabled={preferences.practiceRemindersEnabled}
            practiceReminderTime={preferences.practiceReminderTime}
            onUpdate={updatePreference}
          />

          <DefaultMoodSection
            selectedMood={preferences.defaultMood}
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
