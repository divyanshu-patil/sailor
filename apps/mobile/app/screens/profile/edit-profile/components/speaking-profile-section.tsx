import React from "react";
import { Section, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

import {
  ExperienceLevel,
  Profession,
  PROFESSIONS,
  PROFESSION_LABELS,
} from "@/types/user";
import { EXPERIENCE_LEVELS } from "./constants";

const NOT_SET = "not_set";

/**
 * The two profile fields that change how a script is written. Part of Edit
 * Profile's form: a pick is held with the nickname and saved by the same Save.
 */
export function SpeakingProfileSection({
  profession,
  experienceLevel,
  onProfessionChange,
  onExperienceLevelChange,
}: {
  profession: Profession | null;
  experienceLevel: ExperienceLevel;
  onProfessionChange: (value: Profession) => void;
  onExperienceLevelChange: (value: ExperienceLevel) => void;
}) {
  return (
    <Section
      title="Speaking Profile"
      footer={
        <Text>
          Used to write scripts in your voice — examples from your field, and
          pacing and delivery cues matched to your experience.
        </Text>
      }
    >
      <Picker
        label="Profession"
        // A picker's selection has to match one of its tags; with no
        // profession yet, "Not set" is that tag rather than a nil SwiftUI
        // can't place.
        selection={profession ?? NOT_SET}
        onSelectionChange={(value) => {
          if (value !== NOT_SET) onProfessionChange(value as Profession);
        }}
        modifiers={[pickerStyle("menu")]}
      >
        {profession ? null : (
          <Text modifiers={[tag(NOT_SET)]}>Not set</Text>
        )}
        {PROFESSIONS.map((p) => (
          <Text key={p} modifiers={[tag(p)]}>
            {PROFESSION_LABELS[p]}
          </Text>
        ))}
      </Picker>
      <Picker
        label="Experience"
        selection={experienceLevel}
        onSelectionChange={(value) =>
          onExperienceLevelChange(value as ExperienceLevel)
        }
        modifiers={[pickerStyle("menu")]}
      >
        {EXPERIENCE_LEVELS.map((level) => (
          <Text key={level.tag} modifiers={[tag(level.tag)]}>
            {level.label}
          </Text>
        ))}
      </Picker>
    </Section>
  );
}
