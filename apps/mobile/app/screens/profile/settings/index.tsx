// SettingsScreen.tsx
// Built with @expo/ui/swift-ui (SwiftUI bridge, Expo UI ~56.x), same pattern
// as EditProfileScreen.tsx — Host is the single root, everything below it
// is a real SwiftUI view tree. iOS only.
//
// Requires a dev client. iOS only — this file has no Android path.

import React, { useCallback, useEffect, useState } from "react";
import { Link, Stack, useRouter } from "expo-router";
import Constants from "expo-constants";
import {
  Host,
  Form,
  Section,
  Button,
  Toggle,
  Picker,
  DatePicker,
  Text,
  Image,
  HStack,
  VStack,
  Spacer,
  Overlay,
  Alert,
  ProgressView,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  padding,
  frame,
  buttonStyle,
  controlSize,
  tint,
  disabled,
  pickerStyle,
  progressViewStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";

// Swap these two imports for "./appearance.service" and
// "./preferences.service" once the real backend endpoints are live —
// same export names, drop-in replacement.
import { appearanceService } from "@/services/appearance.debug.service";
import { preferencesService } from "@/services/preferences.debug.service";
import { AppearanceOption } from "@/services/appearance.service";
import { ScriptMood, UserPreferences } from "@/services/preferences.service";

const ACCENT = "#6C5CE7"; // swap for the Sailors brand accent
const DESTRUCTIVE_RED = "#FF3B30"; // iOS system red

const MOOD_OPTIONS: { tag: ScriptMood; label: string }[] = [
  { tag: "confident", label: "Confident" },
  { tag: "calm", label: "Calm" },
  { tag: "playful", label: "Playful" },
  { tag: "reflective", label: "Reflective" },
  { tag: "energetic", label: "Energetic" },
];

// Turns "18:00" into a Date on today's date, and back, so the DatePicker
// (which speaks in Date objects) can round-trip through the "HH:mm" string
// the backend stores.
function timeStringToDate(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function dateToTimeString(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

const SettingsScreen = () => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [appearanceOptions, setAppearanceOptions] = useState<
    AppearanceOption[]
  >([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  // Load appearance options + the user's current preferences in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [options, prefs] = await Promise.all([
          appearanceService.getOptions(),
          preferencesService.getPreferences(),
        ]);
        if (!cancelled) {
          setAppearanceOptions(options);
          setPreferences(prefs);
        }
      } catch {
        if (!cancelled) {
          showAlert("Couldn't load your settings. Pull to try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAlert]);

  // Generic "update one field, optimistically, and persist it" helper.
  // Settings screens save as you go rather than needing an explicit Save
  // button, so every control below calls this directly.
  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K],
    ) => {
      setPreferences((prev) => (prev ? { ...prev, [key]: value } : prev));
      try {
        await preferencesService.updatePreferences({ [key]: value });
      } catch {
        showAlert(
          "That change didn't save. Check your connection and try again.",
        );
      }
    },
    [showAlert],
  );

  const handleDeleteAccount = useCallback(() => {
    setShowDeleteConfirm(false);
    // TODO: wire up to the real delete-account flow
    console.log("Account deletion requested");
  }, []);

  const rowLabelModifiers = [
    frame({ width: 140, alignment: "leading" as const }),
    foregroundStyle({
      type: "hierarchical" as const,
      style: "secondary" as const,
    }),
  ];

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
          {/* Appearance */}
          <Section title="Appearance">
            <VStack spacing={16} modifiers={[padding({ vertical: 8 })]}>
              {chunk(appearanceOptions, 3).map((row, rowIndex) => (
                <HStack key={rowIndex} spacing={24}>
                  {row.map((option) => {
                    const isSelected = option.id === preferences.appearanceId;
                    return (
                      <Button
                        key={option.id}
                        onPress={() =>
                          updatePreference("appearanceId", option.id)
                        }
                        modifiers={[buttonStyle("plain")]}
                      >
                        <VStack spacing={6}>
                          <Overlay alignment="center">
                            <Image
                              systemName="circle.fill"
                              size={44}
                              color={option.hex}
                            />
                            {isSelected && (
                              <Overlay.Content>
                                <Image
                                  systemName="checkmark"
                                  size={16}
                                  color="white"
                                />
                              </Overlay.Content>
                            )}
                          </Overlay>
                          <Text
                            modifiers={[
                              font({ size: 12 }),
                              foregroundStyle({
                                type: "hierarchical",
                                style: "secondary",
                              }),
                            ]}
                          >
                            {option.name}
                          </Text>
                        </VStack>
                      </Button>
                    );
                  })}
                </HStack>
              ))}
            </VStack>
          </Section>

          {/* Practice experience */}
          <Section title="Practice">
            <Toggle
              isOn={preferences.emotionHapticsEnabled}
              onIsOnChange={(value) =>
                updatePreference("emotionHapticsEnabled", value)
              }
              label="Emotion Haptics"
              modifiers={[tint(ACCENT)]}
            />
            <Toggle
              isOn={preferences.practiceRemindersEnabled}
              onIsOnChange={(value) =>
                updatePreference("practiceRemindersEnabled", value)
              }
              label="Practice Reminders"
              modifiers={[tint(ACCENT)]}
            />
            {preferences.practiceRemindersEnabled && (
              <DatePicker
                title="Reminder Time"
                selection={timeStringToDate(preferences.practiceReminderTime)}
                displayedComponents={["hourAndMinute"]}
                onDateChange={(date) =>
                  updatePreference(
                    "practiceReminderTime",
                    dateToTimeString(date),
                  )
                }
              />
            )}
          </Section>

          {/* Default mood */}
          <Section
            title="Default Mood"
            footer={
              <Text>
                Sets the emotional tone used when a new script is generated. You
                can always change it per-script afterward.
              </Text>
            }
          >
            <Picker
              label="Script Mood"
              selection={preferences.defaultMood}
              onSelectionChange={(value) =>
                updatePreference("defaultMood", value as ScriptMood)
              }
              modifiers={[pickerStyle("menu")]}
            >
              {MOOD_OPTIONS.map((mood) => (
                <Text key={mood.tag} modifiers={[tag(mood.tag)]}>
                  {mood.label}
                </Text>
              ))}
            </Picker>
          </Section>

          {/* Subscription — RevenueCat wiring TODO */}
          <Section title="Subscription">
            <Alert
              title="Heads Up"
              isPresented={alertVisible}
              onIsPresentedChange={setAlertVisible}
            >
              <Alert.Trigger>
                <Button
                  label="Manage Subscription"
                  onPress={() =>
                    showAlert(
                      "Subscription management is coming soon, powered by RevenueCat.",
                    )
                  }
                  modifiers={[buttonStyle("plain")]}
                />
              </Alert.Trigger>
              <Alert.Actions>
                <Button label="OK" onPress={() => setAlertVisible(false)} />
              </Alert.Actions>
              <Alert.Message>
                <Text>{alertMessage}</Text>
              </Alert.Message>
            </Alert>
          </Section>

          {/* Legal */}
          <Section title="Legal">
            <Link href="/settings/privacy-policy" asChild>
              <Button modifiers={[buttonStyle("plain")]}>
                <HStack>
                  <Text>Privacy Policy</Text>
                  <Spacer />
                  <Image systemName="chevron.right" size={14} color="#C7C7CC" />
                </HStack>
              </Button>
            </Link>
            <Link href="/settings/terms-of-service" asChild>
              <Button modifiers={[buttonStyle("plain")]}>
                <HStack>
                  <Text>Terms of Service</Text>
                  <Spacer />
                  <Image systemName="chevron.right" size={14} color="#C7C7CC" />
                </HStack>
              </Button>
            </Link>
          </Section>

          {/* App version */}
          <Section>
            <HStack alignment="lastTextBaseline">
              <Text>Version</Text>
              <Spacer />
              <Text
                modifiers={[
                  font({ size: 13 }),
                  foregroundStyle({
                    type: "hierarchical",
                    style: "secondary",
                  }),
                ]}
              >
                {Constants.expoConfig?.version ?? "1.0.0"} (
                {Constants.expoConfig?.ios?.buildNumber ??
                  Constants.expoConfig?.android?.versionCode?.toString() ??
                  "1"}
                )
              </Text>
            </HStack>
          </Section>

          {/* Account & Security */}
          <Section
            title="Account & Security"
            footer={
              <Text>
                This permanently deletes your account, scripts, and practice
                history.
              </Text>
            }
          >
            <Alert
              title="Delete account?"
              isPresented={showDeleteConfirm}
              onIsPresentedChange={setShowDeleteConfirm}
            >
              <Alert.Trigger>
                <Button
                  label="Delete Account"
                  role="destructive"
                  onPress={() => setShowDeleteConfirm(true)}
                  modifiers={[
                    buttonStyle("plain"),
                    foregroundStyle(DESTRUCTIVE_RED),
                  ]}
                />
              </Alert.Trigger>
              <Alert.Actions>
                <Button
                  label="Delete"
                  role="destructive"
                  onPress={handleDeleteAccount}
                />
                <Button label="Cancel" role="cancel" />
              </Alert.Actions>
              <Alert.Message>
                <Text>
                  This permanently deletes your account and all data. This
                  cannot be undone.
                </Text>
              </Alert.Message>
            </Alert>
          </Section>
        </Form>
      </Host>
    </>
  );
};

export default SettingsScreen;
