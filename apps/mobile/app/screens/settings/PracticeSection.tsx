import React from "react";
import { Section, Toggle, DatePicker } from "@expo/ui/swift-ui";
import { tint } from "@expo/ui/swift-ui/modifiers";
import { UserPreferences } from "@/types/settings/preferences";

const ACCENT = "#6C5CE7";

function timeStringToDate(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function dateToTimeString(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

interface PracticeSectionProps {
  emotionHapticsEnabled: boolean;
  practiceRemindersEnabled: boolean;
  practiceReminderTime: string;
  onUpdate: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
}

export function PracticeSection({
  emotionHapticsEnabled,
  practiceRemindersEnabled,
  practiceReminderTime,
  onUpdate,
}: PracticeSectionProps) {
  return (
    <Section title="Practice">
      <Toggle
        isOn={emotionHapticsEnabled}
        onIsOnChange={(value) => onUpdate("emotionHapticsEnabled", value)}
        label="Emotion Haptics"
        modifiers={[tint(ACCENT)]}
      />
      <Toggle
        isOn={practiceRemindersEnabled}
        onIsOnChange={(value) => onUpdate("practiceRemindersEnabled", value)}
        label="Practice Reminders"
        modifiers={[tint(ACCENT)]}
      />
      {practiceRemindersEnabled && (
        <DatePicker
          title="Reminder Time"
          selection={timeStringToDate(practiceReminderTime)}
          displayedComponents={["hourAndMinute"]}
          onDateChange={(date) =>
            onUpdate("practiceReminderTime", dateToTimeString(date))
          }
        />
      )}
    </Section>
  );
}
