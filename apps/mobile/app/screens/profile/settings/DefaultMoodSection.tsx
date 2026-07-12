import React from "react";
import { Section, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import {
  ScriptMood,
  UserPreferences,
} from "@/services/preferences.debug.service";

const MOOD_OPTIONS: { tag: ScriptMood; label: string }[] = [
  { tag: "confident", label: "Confident" },
  { tag: "calm", label: "Calm" },
  { tag: "playful", label: "Playful" },
  { tag: "reflective", label: "Reflective" },
  { tag: "energetic", label: "Energetic" },
];

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
          Sets the emotional tone used when a new script is generated. You can
          always change it per-script afterward.
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
