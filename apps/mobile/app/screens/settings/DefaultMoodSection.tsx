import React from "react";
import { Section, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import {
  MOOD_OPTIONS,
  ScriptMood,
  UserPreferences,
} from "@/types/settings/preferences";

interface DefaultMoodSectionProps {
  selectedMood: ScriptMood;
  onUpdate: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
}

export function DefaultMoodSection({
  selectedMood,
  onUpdate,
}: DefaultMoodSectionProps) {
  return (
    <Section
      title="Default Mood"
      footer={
        <Text>
          The emotional tone new scripts are written in. Pre-selected in the
          generator, where you can change it for a single script.
        </Text>
      }
    >
      <Picker
        label="Script Mood"
        selection={selectedMood}
        onSelectionChange={(value) =>
          onUpdate("defaultMood", value as ScriptMood)
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
  );
}
